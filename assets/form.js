

exports.document = {
    defaultStyle: {
		font: 'Times'
	},
	info: {
		title: 'AWS Marketplace Reseller',
		author: '0x4447',
		subject: 'AWS Marketplace Reseller',
		keywords: 'aws marketplace reseller',
		creator: '0x4447',
		producer: '0x4447'
    },
    footer: function(current_page, pageCount) {

		return [
			{
				text: 'Page ' + current_page + ' of ' + pageCount,
				alignment: 'center',
				margin: [0, 10, 0, 0]
			}
		];

	},
	content: [
		'First paragraph',
		'Another paragraph, this time a little bit longer to make sure, this line will be divided into at least two lines'
	]
	
}