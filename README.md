# Email Reseller

Autoamte the process of sending out a new reseller subscription.

# Environment variables

Copy&Paste the following command to create the `.env` file with all the environment variables needed for the project.

```
printf "%s\n" \
EMAIL_AWS=DATA \
EMAIL_WE=DATA \
AWS_ACCESS_KEY_ID=DATA \
AWS_SECRET_ACCESS_KEY=DATA \
>> .env
```

# How to run Lambda Locally

```
npm install
```

And once you have all the modules installed you can run:

```
npm run locally
```

# Understendig Our Files

This list explains in details what each file in the project is for, this way you don't have to guess, you can just read the facts.

- `.github`: this foler contains all the files for GitHub to be using to make the page work how we sy it should.
- `.payloads`: this fodler contains files that mimick the payloads comming to a Lambda, use it to test your code.
- `.editorconfig`: this file tels your editor how it should work with this repo.
- `.env`: this is where all the environment variables go, and are loaded at startup time.
- `.gitignore`: is a list of files nad folder to ignore by git.
- `.loader`: is the file used by the `npm run build` to execute the code as if it was beeing executed within AWS Lambda. It mimiks the environemnt 1:1.
- `buildspec.yml`: this file contains all the instructions for AWS CodeBuild.
- `index.js`: the initial file that is executed by NodeJS
- `package.json`: this file is used by NPM to know how to behave and what to install.
- `README.md`: you are reding it.
