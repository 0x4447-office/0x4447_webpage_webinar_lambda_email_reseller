let AWS = require("aws-sdk");
let mustache = require('mustache');
let pdfmake = require('pdfmake');

//
//	Bringing S3 to life.
//
let s3 = new AWS.S3({
	apiVersion: '2006-03-01'
});

//
//	Load all the email templates.
//
let templates = require('./assets/templates/index');

//
//	Load the Form template.
//
let form = require('./assets/form');

//
//	This lambda will send an email to me, AWS and the reseller regardign the 
//	the resellens of our prodcuts.
//
exports.handler = (event) => {

	return new Promise(function(resolve, reject) {

		//
		//	1. This container holds all the data to be passed around the chain.
		//
		let container = {
			req: {
				bucket_name: event.Records[0].s3.bucket.name,
				escaped_key: event.Records[0].s3.object.key
			},
			emails:{
				we: process.env.EMAIL_WE,
				aws: process.env.EMAIL_AWS
			},
			templates: templates,
			form: JSONfn.parse(JSONfn.stringify(form)),
			unescaped_key: null,
			//
			//	Storing here the S3 object.
			//
			message: {
				we: {},
				reseller: {},
				aws: {},
			},
			pdf: null,
			//
			//	The default response for Lambda.
			//
			res: {
                message: "OK"
            }
		}

		//
		//	->	Start the chain.
		//
		unescape_key(container)
			.then(function(container) {

				return load_object(container);

			}).then(function(container) {

				return generate_pdf(container);

			}).then(function(container) {

				return write_message_to_we(container);

			}).then(function(container) {

				return save_object_to_we(container);

			}).then(function(container) {

				return write_message_to_reseller(container);

			}).then(function(container) {

				return save_object_to_reseller(container);

			}).then(function(container) {

				return write_message_to_aws(container);

			}).then(function(container) {

				return save_object_to_aws(container);

			}).then(function(container) {

				//
				//  ->  Send back the good news.
				//
				return resolve(container.res);

			}).catch(function(error) {

				//
				//	->	Stop and surface the error.
				//
				return reject(error);

			});
	});
};

//	 _____    _____     ____    __  __   _____    _____   ______    _____
//	|  __ \  |  __ \   / __ \  |  \/  | |_   _|  / ____| |  ____|  / ____|
//	| |__) | | |__) | | |  | | | \  / |   | |   | (___   | |__    | (___
//	|  ___/  |  _  /  | |  | | | |\/| |   | |    \___ \  |  __|    \___ \
//	| |      | | \ \  | |__| | | |  | |  _| |_   ____) | | |____   ____) |
//	|_|      |_|  \_\  \____/  |_|  |_| |_____| |_____/  |______| |_____/
//

//
//	We need to process the path received by S3 since AWS dose escape
//	the string in a special way. They escape the string in a HTML style
//	but for whatever reason they convert spaces in to +ses.
//
function unescape_key(container)
{
	return new Promise(function(resolve, reject) {

		console.info("unescape_key");

		//
		//	1.	First we convert the + in to spaces.
		//
		let plus_to_space = container.req.escaped_key.replace(/\+/g, ' ');

		//
		//	2.	And then we unescape the string, other wise we lose
		//		real + characters.
		//
		let unescaped_key = decodeURIComponent(plus_to_space);

		//
		//	3.	Save the result for the next promise.
		//
		container.unescaped_key = unescaped_key;

		//
		//	->	Move to the next chain.
		//
		return resolve(container);

	});
}

//
//	In this step we are going to load the object which trigerd this lamda,
//	so we can see what type of misteries are hiddin in it.
//
function load_object(container)
{
	return new Promise(function(resolve, reject) {

		console.info("load_object");
		
		//
		//	1.	Prepare the query.
		//
		let params = {
			Bucket: container.req.bucket_name,
			Key: container.unescaped_key
		};

		//
		//	-> Execute the query.
		//
		s3.getObject(params, function (error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			} 

			//
			//	2.	Save the object for the next promise.
			//
			container.reseller_details = JSON.parse(data.Body.toString());
			
			//
			//	->	Move to the next promise.
			//
			return resolve(container);
		
		});

	});
}

//
//	Once we have all the data. We make the PDF at this point so we can send
//	one copy to me for reference, and one copy to AWS itself.
//
function generate_pdf(container)
{
	return new Promise(function(resolve, reject) {

		console.info("generate_pdf");

		//
		//	1.	Load the default fonts that we want to use in the document.
		//
		let printer = new pdfmake({
			Times: {
				normal: 'Times-Roman',
				bold: 'Times-Bold',
				italics: 'Times-Italic',
				bolditalics: 'Times-BoldItalic'
			},
			Helvetica: {
				normal: 'Helvetica',
				bold: 'Helvetica-Bold',
				italics: 'Helvetica-Oblique',
				bolditalics: 'Helvetica-BoldOblique'
			}
		});

		//
		//	2.	Generate the PDF based on the new data and template.
		//
		let pdfDoc = printer.createPdfKitDocument(container.form.document);

		//
		//	3.	This module implemented a Read Stream, instead of giving
		//		back a regular buffer. So we have to read from it in chunks
		//		store those partial buffer in this array.
		//
		let array_buffers = [];

		//
		//	4.	By reading until there is data.
		//
		pdfDoc.on('data', function(chunk) {

			//
			//	1.	Store the chunks in to the above array.
			//
			array_buffers.push(Buffer.from(chunk));

		});

		//
		//	5.	And once there is no more data to read, we combine the
		//		array composed of small buffers in to the final one, which
		//		we can then send to S3.
		//
		pdfDoc.on('end', function() {

			//
			//	1.	Once there is no more data we take the array of buffers and
			//		combine them in to one.
			//
			container.pdf = Buffer.concat(array_buffers);

			//
			//	->	Move to the next chain
			//
			return resolve(container);

		});

		//
		//	6.	Tell PDF Doc to send data till the end? Not sure about the
		//		logic here, but without calling the end() function we get
		//		all the data out of the stream but the final chunks, so we
		//		miss part of the PDF.
		//
		//		So: do not remove the call.
		//
		pdfDoc.end();

	});
}

//
//	Generate the content of the email to myself so I can get a notification 
//	when someone sings up.
//
function write_message_to_we(container)
{
	return new Promise(function(resolve, reject) {

		console.info("write_message_to_we");
		
		//
		//	1.	Convert the S3 payload in to a string and jsut use it as it is
		//		since we don't need anything fancy for ourselfs.
		//
		let reseller_details = JSON.stringify(container.reseller_details, null, 4);
		
		//
		//	2.	Prepare the data to be replaced.
		//
		let data = {
			reseller_details: reseller_details
		}

		//
		//	3.	Render the message.
		//
		let message = mustache.render(container.templates.we.text, data);

		//
		//	4.	Save it for the next promise.
		//
		container.message.we = {
			subject: container.templates.we.subject,
			body: message,
			emails: {
				to: {
					name: "David Gatti",
					email: container.emails.we
				}
			},
			attachments: [
				{
					filename: 'reseller.pdf',
					content: container.pdf.toString('base64'),
					encoding: 'base64'
				}
			]
		}

		//
		//	->	Move to the next promise.
		//
		return resolve(container);
		
	});
}

//
//	Then I take the message and save it to SMTP S3 to be sent out by SNS.
//
function save_object_to_we(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_object_to_we");
		
		//
		//	1.	Prepare the query.
		//
		let params = {
			Bucket: '0x4447-web-us-east-1-smtp',
			Key: Date.now() + '.json',
			Body: JSON.stringify(container.message.we)
		};

		//
		//	-> Execute the query.
		//
		s3.putObject(params, function (error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			} 
			
			//
			//	->	Move to the next promise.
			//
			return resolve(container);
		
		});

	});
}

//
//	Generate the content of the email to myself so I can get a notification 
//	when someone sings up.
//
function write_message_to_reseller(container)
{
	return new Promise(function(resolve, reject) {

		console.info("write_message_to_reseller");

		//
		//	1.	Render the message.
		//
		let message = mustache.render(container.templates.reseller.text, container.reseller_details);

		//
		//	2.	Create the full name of the reseller.
		//
		let full_name = container.reseller_details.first_name 
					  + " " 
					  + container.reseller_details.last_name;

		//
		//	3.	Save it for the next promise.
		//
		container.message.reseller = {
			subject: container.templates.reseller.subject,
			body: message,
			emails: {
				to: {
					name: full_name,
					email: container.reseller_details.email
				},
				reply_to: {
					name: "David Gatti",
					email: container.emails.we
				}
			}
		}

		//
		//	->	Move to the next promise.
		//
		return resolve(container);
		
	});
}

//
//	Then I take the message and save it to SMTP S3 to be sent out by SNS.
//
function save_object_to_reseller(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_object_to_reseller");
		
		//
		//	1.	Prepare the query.
		//
		let params = {
			Bucket: '0x4447-web-us-east-1-smtp',
			Key: Date.now() + '.json',
			Body: JSON.stringify(container.message.reseller)
		};

		//
		//	-> Execute the query.
		//
		s3.putObject(params, function (error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			} 
			
			//
			//	->	Move to the next promise.
			//
			return resolve(container);
		
		});

	});
}

//
//	With the iCal file done, we can make the email message for the user who
//	singed up to the webinar.
//
function write_message_to_aws(container)
{
	return new Promise(function(resolve, reject) {

		console.info("write_message_to_aws");

		//
		//	1.	Render the message.
		//
		let message = mustache.render(container.templates.aws.text, container.event);

		//
		//	2.	Save it for the next promise.
		//
		container.message.aws = {
			subject: container.templates.aws.subject,
			body: message,
			emails: {
				to: {
					name: "AWS",
					email: container.emails.aws
				},
				reply_to: {
					name: "David Gatti",
					email: container.emails.we
				}
			},
			attachments: [
				{
					filename: 'reseller.pdf',
					content: container.pdf.toString('base64'),
					encoding: 'base64'
				}
			]
		}

		//
		//	->	Move to the next promise.
		//
		return resolve(container);

	});
}

//
//	Finally save the user email to S3 to be sent out.
//
function save_object_to_aws(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_object_to_aws");
		
		//
		//	1.	Prepare the query.
		//
		let params = {
			Bucket: '0x4447-web-us-east-1-smtp',
			Key: Date.now() + '.json',
			Body: JSON.stringify(container.message.aws)
		};

		//
		//	-> Execute the query.
		//
		s3.putObject(params, function (error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			} 
			
			//
			//	->	Move to the next promise.
			//
			return resolve(container);
		
		});

	});
}

//	 _    _   ______   _        _____    ______   _____     _____ 
//	| |  | | |  ____| | |      |  __ \  |  ____| |  __ \   / ____|
//	| |__| | | |__    | |      | |__) | | |__    | |__) | | (___  
//	|  __  | |  __|   | |      |  ___/  |  __|   |  _  /   \___ \ 
//	| |  | | | |____  | |____  | |      | |____  | | \ \   ____) |
//	|_|  |_| |______| |______| |_|      |______| |_|  \_\ |_____/ 
//

//
//  With this object we can serialize javascript object with
//	such property as Function and re-create original object from this string.
//
//	We have to use these helper functions, because
//	there're `footer` and `fillColor` functions in plan_template.js
//
let JSONfn = {
	stringify(obj) {
		return JSON.stringify(obj,function(key, value) {

			return (typeof value === 'function' ) ? value.toString() : value;

		});
	},
	parse(str) {
		return JSON.parse(str,function(key, value) {
			
			if(typeof value != 'string')
			{
				return value;
			}
			
			return ( value.substring(0,8) == 'function') ? eval('('+value+')') : value;

		});
	}
};