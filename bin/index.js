var __pg = require('./pg.node');

var events 		= require('events');
var querystring = require('querystring');
var util 		= require('util');
var pg = {};
pg.ResultTable;
pg.Pool = function() {
  this.__connectionInfo = "";
  this.__breakCallback = null;
  this.__queryQueue = new pg.QueryQueue;
  this.__connections = [];
  this.__maxSize = 0
};
pg.Pool.prototype.init = function(size, options, opt_breakCallback) {
  this.__connectionInfo = decodeURI(querystring.stringify(options, " "));
  this.__breakCallback = opt_breakCallback || null;
  this.__maxSize = size
};
pg.Pool.prototype.exec = function(query, opt_callback) {
  this.__queryQueue.push(new pg.Query(query, opt_callback));
  var i = 0, l = this.__connections.length;
  var allBusy = true;
  while(i < l) {
    if(!this.__connections[i].isBusy()) {
      this.__connections[i].process();
      allBusy = false
    }
    i++
  }
  if(allBusy === true && l < this.__maxSize) {
    this.__spawnConnection()
  }
};
pg.Pool.prototype.destroy = function() {
  while(this.__connections.length > 0) {
    this.__connections.shift().disconnect()
  }
};
pg.Pool.prototype.__spawnConnection = function() {
  var self = this;
  var connection = new pg.Connection(this.__queryQueue, this.__connectionInfo, function(connection, error) {
    var index = self.__connections.indexOf(connection);
    if(index !== -1) {
      self.__connections.splice(index, 1)
    }
    if(self.__breakCallback !== null) {
      self.__breakCallback(error)
    }
  });
  this.__connections.push(connection)
};
pg.Query = function(command, opt_callback) {
  this.command = command;
  this.callback = null;
  this.next = null;
  this.prev = null;
  if(opt_callback !== undefined) {
    this.callback = opt_callback
  }
};
pg.QueryQueue = function() {
  this.__origin = new pg.Query("");
  this.__origin.prev = this.__origin;
  this.__origin.next = this.__origin;
  this.length = 0
};
pg.QueryQueue.prototype.push = function(query) {
  var tail = this.__origin.next;
  tail.prev = query;
  query.next = tail;
  this.__origin.next = query;
  query.prev = this.__origin;
  this.length++
};
pg.QueryQueue.prototype.shift = function() {
  if(this.__origin.prev !== this.__origin) {
    var head = this.__origin.prev;
    head.prev.next = this.__origin;
    this.__origin.prev = head.prev;
    head.next = null;
    head.prev = null;
    this.length--;
    return head
  }
  return null
};
var ii = 0;
pg.Connection = function(queryQueue, options, breakCallback) {
  console.log("connection", ++ii);
  this.__queryQueue = queryQueue;
  this.__currentQuery = null;
  this.__descriptor = 0;
  this.__isBusy = false;
  var self = this;
  var descriptor = __pg.connect(options, function(broken, task, err, res) {
    if(broken) {
      console.log("disconnected");
      self.__descriptor = 0;
      breakCallback(self, err)
    }else {
      self.__isBusy = false
    }
    if(task === 1) {
      console.log("query exec");
      var query = self.__currentQuery;
      self.__currentQuery = null;
      self.process();
      process.nextTick(function() {
        if(query !== null) {
          query.callback(err, res);
          query.callback = null
        }
      })
    }else {
      if(task === 0 && !broken) {
        console.log("connected");
        self.__descriptor = descriptor;
        self.process()
      }
    }
  })
};
pg.Connection.prototype.isBusy = function() {
  return this.__isBusy
};
pg.Connection.prototype.process = function() {
  if(this.__descriptor !== 0 && this.__currentQuery === null) {
    this.__isBusy = true;
    this.__currentQuery = this.__queryQueue.shift();
    if(this.__currentQuery !== null) {
      __pg.exec(this.__descriptor, this.__currentQuery.command)
    }else {
      this.disconnect()
    }
  }
};
pg.Connection.prototype.disconnect = function() {
  if(this.__descriptor !== 0) {
    __pg.disconnect(this.__descriptor);
    this.__descriptor = 0
  }
};
module.exports = new pg.Pool;

