//{% autoescape off %}

/*
 * The main js file for client side's game page.
 * This file is to be process by code template
 */
// === class definition ===

/**
 * Priority queue base on time of the game message.
 * smaller time has priority.
 * Could have done a binary heap... but it's a scripting language
 * ... performance is not really the first concern.
 * 
 * I'm allowing duplicate time stamp on purpose
 * even though it shouldn't occur.
 */
function GameMessageQueue() {
	this.store = new Array();
	this.size = 0;
	this.enqueue = function(gameMessage) {
		var i = 0;
		while(i<this.size && this.store[i].time <= gameMessage.time)
			i++;		
		this.store.splice(i, 0, gameMessage);
		this.size++;
	};
	this.peek = function() {
		return this.store[0];
	};
	this.dequeue = function() {
		this.size--;
		return this.store.shift();
	};
	this.processIfPossible = function() {
		while(this.size>0 && this.peek().isProcessable())
			game.currentState.doHandleEvent(this.dequeue());
	};
	this.receive = function(gameMessage) {
		if(gameMessage.isProcessable()) {
			game.currentState.doHandleEvent(gameMessage);
			this.processIfPossible();
		}else
			this.enqueue(gameMessage);
	};
}

/**
 * encapsulate all server to client communication
 */
function Receiver() {
	// This constructor is only used ONCE
	this.channel = new goog.appengine.Channel('{{ token }}');
	
	// queue for game message that arrives out-of-order
	this.gameMessageQueue = new GameMessageQueue();
	
	// call back functions for socket
	this.onOpened = function() {/*blank*/};
	this.onError = function(error) {
		console.error('on error',error);
		if(error.code == 0 || error.code == -1)
			this.getSocket();
			return;
		this.renewToken();
	};
	this.onClose = function() {
		console.error('on close');
		this.getSocket();
		console.error('reconnected to the server at onClose.');
	};
	this.onMessage = function(message) {
		parsedJSON = JSON.parse(message.data);
		switch(parsedJSON.messageType) {
		case ChatMessage.messageType:
			View.updateChat(parsedJSON.chat, parsedJSON.userId);
			console.log(parsedJSON.chat);
			break;
		case NewGame.messageType:
			// TODO deprecated?
			break;
		case GameMessage.messageType:
			var gameMessage = GameMessage.constructFromRaw(parsedJSON);
			receiver.gameMessageQueue.receive(gameMessage);
			break;
		default:
			console.log('unrecognised message: '+message);
		}
	};
	
	// get socket from channel
	this.getSocket = function() {
		this.socket = this.channel.open();
		this.socket.onopen = this.onOpened;
		this.socket.onerror = this.onError;
		this.socket.onclose = this.onClose;
		this.socket.onmessage = this.onMessage;
	};
	this.getSocket();
	
	// get new channel's token, channel object and socket object.
	this.renewToken = function() {
		console.error('lost connection with server. trying to reconnnect.');
		var xhr = new XMLHttpRequest();
        xhr.open('POST', '/renewToken?clientID=' + clientID, false);
        xhr.send();
        
		this.channel = new goog.appengine.Channel(xhr.responseString);
		this.getSocket();
		console.error('reconnected to the server.');
	};
}

// === global variables ===

// tells what screen of the application is present
// Obviously since this is the game page, it's going to be some game id.
var screen = '{{ screen }}';

// the id of this game page
var clientID = '{{ clientID }}';

// the only instance of Receiver object
var receiver = new Receiver();

var rawData = {{ data }}; 

// global variable representing the game
var game = new Game({{ data }});

//User profile of this client
var client = Client.createFromGame('{{ username }}');

//{% endautoescape %}
