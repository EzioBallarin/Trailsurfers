/*
 * TrailSurf intent JS backbone
 */
'use strict';

// Strings
const AWSregion = "us-east-1";
const dbTable = "TrailSurferDB";
const APP_ID = "amzn1.ask.skill.3e6b03ac-4a46-468b-a6fe-99b3c6c52d65";

const languageStrings = {
    'en': {
        translation: {
        SKILL_NAME: 'Trail Surfer',

        WELCOME_MESSAGE: 
        "Welcome to %s. "
        + "You can ask for something like, find me a hike."
        + "... Now, what can I help you with?",

        WELCOME_REPROMPT:
        'For instructions on what you can say, please say help me.',

        HELP_MESSAGE:
        "You can ask for something like,"  
        + "find me a hike, or, you can say exit."
        + "You can also specify things such as a location"
        + "of where to look for hikes, the desired trail's length,"
        + " or the trail's difficulty."
        + "Now, what can I help you with?",

        HELP_REPROMPT:
        "You can ask for something like," 
        + "find me a hike, or, you can say exit..."
        + "Now, what can I help you with?",

        STOP_MESSAGE:
        'Goodbye!',
        },
    }
};

// Dependencies
const Alexa = require('alexa-sdk');
const awsSDK = require('aws-sdk');
awsSDK.config.update({
    region: AWSregion
});

const docClient = new awsSDK.DynamoDB.DocumentClient();

const handlers = {
    
    'LaunchRequest': function () {
        this.attributes.speechOutput = this.t('WELCOME_MESSAGE', this.t('SKILL_NAME'));
        // If the user either does not reply to 
        // the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes.repromptSpeech = this.t('WELCOME_REPROMPT');
        this.emit(
            ':ask', 
            this.attributes.speechOutput,
            this.attributes.repromptSpeech
        );
    },
    
    'TrailSurf': function() {
        
        // Set default variables to be changed if slots are
        // specified
        var location = "rohnert park";
        var distance = 5;
        var length = 2;
        var difficulty = 1;
        
        // Get current intent object
        var intentObj = this.event.request.intent;
        
        var slots = intentObj.slots;
        
        // Check to see if the slot has been defined yet
        // slots.location is the slot for location
        // .hasOwnProperty is a JSON object method
        // to check if the given parameter exists as a key
        // in the object the method is called on
        if (slots.location.hasOwnProperty('value')) {
            location = slots.location.value.toLowerCase();
        }
        if (slots.distance.hasOwnProperty('value')) {
            distance = slots.distance.value;
        }
        if (slots.length.hasOwnProperty('value')) {
            length = slots.length.value;
        }
        if (slots.difficulty.hasOwnProperty('value')) {
            difficulty = slots.difficulty.value;
        }
        
        //var length = slots.length.value;
        //var difficulty = slots.difficulty.value;
        
        /* Testing some API for trails
        /*
        var https = require('https');
        var optionsget = {
            host: 'www.transitandtrails.org',
            port: 443,
            path: '/api/v1/trailheads.xml?key=4b0dd632421cd4c3b0126fd01a6e74343b97656e2ced5c24892990c2d77262e8',
            methd: 'GET'
        
        }
        
        var reqGet = https.request(optionsget, function(res){
            console.log("status" + res.statusCode);
            res.on('data', function(d) {
               console.log("GET result: \n");
               console.log(d);
            });
        });
        reqGet.end();
        reqGet.on('error', function(e) {
            console.log(e);
        })
        console.log(slots);
        console.log("Location: " + location);
        */
        /* TODO: database querying here */
        const dynamoParams = {
            TableName: dbTable,
            KeyConditionExpression: 'HikeLocation = :loc',
            ExpressionAttributeValues: {
                ':loc': location
            }
        };
        
        // Read the items from the table that match 
        // the given Location, difficulty, and length
        readDynamoItem(dynamoParams, myResult=>{
            console.log(myResult);
            
            // Initialize the phrase that will be emitted
            var phrase = 'I found ';
            
            // Store the number of hikes returned
            var count = myResult.Count;
            var hikes = myResult.Items;
            
            var hikeCountPhrase = '';
            var hikeKnowledgePhrase = '';
            
            if (count == 1)
                hikeCountPhrase = 'hike';
            else
                hikeCountPhrase = 'hikes';
            
            // Force pronunciation of Rohnert
            if (location == 'rohnert park')
                location = 'row nert park';
            
            // Build the phrase for the voice emission by Alexa
            phrase = phrase + count + ' ' + hikeCountPhrase + 
            ' near ' + location;
            
            // Decide whether to ask to look for more hikes (if none found)
            // Or dive into the list returned from the call to the DB
            if (count === 0)
                phrase = phrase + '... Should I look for more?';
            else {
                
                phrase = phrase + '... The first is ' +
                hikes[0].HikeName + '...' +
                'Would you like to know more about it?';
                
            }
            
            
            // Emit response to user
            this.emit(
                ':ask', 
                phrase
            );
        });
        
    },
    'AMAZON.HelpIntent': function () {
        this.attributes.speechOutput = this.t('HELP_MESSAGE');
        this.attributes.repromptSpeech = this.t('HELP_REPROMPT');
        this.emit(
            ':ask',
            this.attributes.speechOutput,
            this.attributes.repromptSpeech
        );
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(
            ':ask',
            this.attributes.speechOutput,
            this.attributes.repromptSpeech
        );
    },
    'AMAZON.StopIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest': function() {
        this.emit(
            ':tell',
            this.t('STOP_MESSAGE')
        );
    },
    'Unhandled': function () {
        this.attributes.speechOutput = this.t('HELP_MESSAGE');
        this.attributes.repromptSpeech = this.t('HELP_REPROMPT');
        this.emit(
            ':ask',
            this.attributes.speechOutput,
            this.attributes.repromptSpeech
        );
    },
};

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function readDynamoItem(params, callback) {

    var AWS = require('aws-sdk');
    AWS.config.update({region: AWSregion});

    var docClient = new AWS.DynamoDB.DocumentClient();

    console.log('reading item from DynamoDB table');

    docClient.query(params, (err, data) => {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));

            callback(data);  // this particular row has an attribute called message

        }
    });

}