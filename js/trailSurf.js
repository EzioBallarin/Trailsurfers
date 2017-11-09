/*
 * TrailSurf intent JS backbone
 */
'use strict';

// Strings
const AWSregion = "us-east-1";
const dbTable = "TrailSurferDB";
const APP_ID = "amzn1.ask.skill.3e6b03ac-4a46-468b-a6fe-99b3c6c52d65";

// Pronuncations of hike and hikes, since Alexa has trouble with these words.
const _hike = '<phoneme alphabet="ipa" ph="haɪk"> hike</phoneme>';
const _hikes = '<phoneme alphabet="ipa" ph="haɪks"> hikes</phoneme>';
const _hiking = '<phoneme alphabet="ipa" ph="ˈhaɪkɪŋ"> hiking</phoneme>';

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
        "You can ask for something like "  
        + "find me a hike, or, you can say exit..."
        + "You can also specify things such as where to look for hikes, "
        + "the desired trail's length, "
        + "or the trail's difficulty......"
        + "Now, what can I help you with?",

        HELP_REPROMPT:
        "You can ask for something like, " 
        + "find me a hike, or, you can say exit... "
        + "Now, what can I help you with?",

        STOP_MESSAGE:
        'Okay, have fun ' + _hiking + '!',
        
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

const states = {
    started: '_STARTED',
    surfing: '_SURFING',
    end: '_ENDED'
};

// Intent Processing
const handlers = {
    
    'LaunchRequest': function () {
        
        this.attributes.state = states.started;
        this.attributes.looping = false;
        
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
    
    /* Not sure how to fix incorrect utterances mapped to this intent*/
    'TrailSurf': function() {
        
        console.log("TrailSurf Intent called");
        console.log("State: " + this.attributes.state);
        console.log("Looping: " + this.attributes.looping);
        
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
                hikes[0].HikeName + '... ' +
                'It is ' + hikes[0].HikeLength + ' miles long... ' +
                'Would you like to know more about it?';
                
            }
            
            // Set current state to be surfing for trails
            // Essentially means we have found hikes, and may or may
            // not be traversing a list of returned results
            this.attributes.state = states['surfing'];
            this.attributes.looping = true;
            
            // Store the returned hikes from DynamoDB into a session varibale,
            // along with the index of the first hike found, 
            // and the overall number of hikes found
            this.attributes.hikes = hikes;
            this.attributes.hikenum = 0;
            this.attributes.hikecount = count;
            
            // Emit response to user
            this.emit(
                ':ask', 
                phrase
            );
        });
        
    },
    
    
    'AMAZON.YesIntent': function(){
        
        
        var response = '';
        var state = this.attributes.state;
        var looping = this.attributes.looping;
        var hikes, hikenum, hikecount, curHike;
        
        // If the user has already searched for hikes,
        // and they have not begun traversing the paginated hikes
        if (state == states.surfing && looping) {
            // Grab the hikes found
            hikes = this.attributes.hikes;
            
            // Grab the current hike index in the list 
            hikenum = this.attributes.hikenum;
            
            // Grab the count of returned hikes
            hikecount = this.attributes.hikecount;
            
            if (hikecount === 0)
                this.emit(':ask', this.attributes.repromptSpeech);
            
            // Store the current hike
            curHike = hikes[hikenum];
            
            response = response + curHike.HikeName + 
            ' is ' + curHike.HikeDificulty + ' difficulty '
            + '... and is ... ' + curHike.HikeType + ' hike... ';
            
            this.attributes.looping = false;
            
            // If there is no next hike, prompt the user for more hikes.
            if (hikenum + 1 >= hikecount) {
                response = response + ' '
                + 'and is the last ' + _hike + ' in that area. Feel free to start over or quit.';
                this.attributes.state = states.end;
                this.emit(':ask', response);
            
            // Start looping through the hikes
            } else {
                this.attributes.hikenum = this.attributes.hikenum + 1;
                response = response + 'Move to the next hike?';
            }

            this.emit(':ask', response);
        
        // If the user has already searched for hikes,
        // and they HAVE begun traversing the paginated hikes
        } else if (state == states.surfing && !looping) {
            
            // Grab the hikes found
            hikes = this.attributes.hikes;
            
            // Grab current hike index in the list
            hikenum = this.attributes.hikenum;
            
            // Grab the total number of hikes in the list
            hikecount = this.attributes.hikecount;
            
            // Store the current hike
            curHike = hikes[hikenum];
            
            // If there is no next hike, prompt the user for more hikes.
            if (hikenum >= hikecount) {
                this.attributes.state = states.end;
                this.emit(':ask', this.attributes.repromptSpeech);
            }
            
            response = response + '... The next hike is ' +
            curHike.HikeName + '... ' +
            'It is ' + curHike.HikeLength + ' miles long... ' +
            'Would you like to know more about it?';
            
            this.attributes.looping = true;
            
            this.emit(':ask', response);
            
        }
        
        this.emit(':tell', '');
    },
    
    // Handler for users saying "no" during the pagination of results from a list of hikes
    'AMAZON.NoIntent': function(){
        

        // Check state of skill, and check if there was a paginated data set returned
        var state = this.attributes.state;
        var looping = this.attributes.looping;
        console.log("NoIntent called");
        console.log("State: " + state, "Looping: " + looping);
        
        // If we potentially have more hikes, call the NextIntent to handle it
        if (state == states.surfing && looping) {
            console.log("No pressed, trying to move onto next");
            console.log("Checking if next hike would be out of bounds");
            console.log("Next hike: " + this.attributes.hikenum + 1);
            console.log("Num of hikes: " + this.attributes.hikecount);
            // If the next hike would be out of bounds, 
            // set the looping flag to false
            if (this.attributes.hikenum + 1 >= this.attributes.hikecount)
                this.attributes.looping = false;
            
            // Let the hike at hikenum and let NextIntent handler take over
            this.attributes.hikenum = this.attributes.hikenum + 1;
            this.emit('AMAZON.NextIntent');
        } 
        
        if (state == states.surfing && !looping) {
            this.emit('SessionEndedRequest');
        }
        
        // Otherwise, we either aren't looping, or don't have any more hikes.
        this.emit(':ask', this.t('WELCOME_REPROMPT'));

    },
    
    // Handler for users saying "next" during the pagination of results form a list of hikes
    'AMAZON.NextIntent': function(){
        
        console.log("NextIntent called");
        
        // Check the skill's state, and if we are traversing a list of hikes.
        // Also declare variables for an eventual response, and
        // relevant information about the current hike
        var state = this.attributes.state;
        var looping = this.attributes.looping;
        var response = '';
        var hikes, hikenum, hikecount, curHike;
        
        console.log("State: " + state, "Looping: " + looping);
        
        // If we're looping through paginated results for a hikes query
        if (state == states.surfing && looping) {
            hikes = this.attributes.hikes;
            this.attributes.hikenum = this.attributes.hikenum + 1;
            hikenum = this.attributes.hikenum;
            hikecount = this.attributes.hikecount;
            console.log("Hikenum: " + hikenum, "Hikecount: " + hikecount);
            
            if (hikecount === 0) {
                this.emit(':ask', this.attributes.repromptSpeech);
            }
            
            if (hikenum >= hikecount) {
                this.emit(':ask', 'Okay, I\'m out of ' + _hikes + ', look for more?');
            }
                
            curHike = hikes[hikenum];
            
            response = response + '... The next hike is ' +
            curHike.HikeName + '... ' +
            'It is ' + curHike.HikeLength + ' miles long... ' +
            'Would you like to know more about it?';
            this.attributes.state = states.surfing;
            this.emit(':ask', response);
            
        // Prompt user for more hikes
        } else if (this.attributes.hikecount === 0) {
            this.emit(':ask', this.attributes.repromptSpeech);
        } else {
            this.attributes.looping = false;
            this.emit(':ask', 'Okay, ' 
            +'I\'m out of ' + _hikes + ' , look for more?');
        }
        
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
    
    // End session and exit skill
    'AMAZON.StopIntent': function () {
        this.emit('SessionEndedRequest');
    },
    
    // Functionally the same as stop
    'AMAZON.CancelIntent': function () {
        
        // Will change this in the future
        this.emit('SessionEndedRequest');
    },
    
    // Save the state of the user from this session
    'SessionEndedRequest': function() {
        //this.emit(':saveState', true);
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
    
    // Register the trailsurfer_state table for 
    // State persistence through multiple sessions
    alexa.dynamoDBTableName = 'trailsurfer_state';
    
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