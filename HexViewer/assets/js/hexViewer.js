// IIFE, prefixed by a comma...
;(function(window, document, undefined) {
	"use strict";

/*
3S Hex Viewer object
Display a chunk of hex data and perform search.
Ideas:
- require a div id to build hex table inside
- data to display is a raw JSON: json = { addr = 0x00000000, data = "08ff5687bc...etc..." }
- call a php API to retrieve data from a given address
- load a list of all known range with additional info like name, type, comments...
- bind a given range to a display widget (timer/gauge, etc)
- data are selectable to keep them highlighted during work session
- tooltip with all possible value taken by pointed data
- if a range is identified as a valid address, possibility to view target in another window
- mode where for every 4 bytes block displayed starting by 01/02/3/04/05/06/07/08/09 (maybe not real need of more than 06)
    -> check if it's a known address and propose to view target in another window
    -> highlight address and propose to view content of target
    -> check if it's a know address and show 

- table to create in DB: 3s_known_range:
	- fields:
		- address
		- length (nb of bytes, x * 0x00)
		- type (b, bs, w, ws, dw, r (a region, itself may contain other known ranges)
		- name (for example: pos_x)
		- group (define groupname where this name belong, for example: P1)
©ESN@2015
*/

// map, build an array using given function through all elements of given array...
function map(a, fn) {
	for(var i = 0, r = []; i < a.length; i++) r[i] = fn(a[i]);
	
	return r;
}

// add 0 before, if needed...
function pad (str, max) {
	str = str.toString();
	return str.length < max ? pad("0" + str, max) : str;
}

// convert an hex data (string) to signed decimal...
// inverse operation: num = -4; (num < 0 ? (0xFFFFFFFF + num + 1) : num).toString(16);
function hex2signed(h) {
	var a = parseInt(h, 16);
	var sd = ((a & 0x8000) > 0)?a - 0x10000:a;
	
	//console.log("hexByte2signed", h, sd);
	
	return sd;
}

// return a new element with given id and class attribute set...
function newElement(type, id, cl) {
	var e = document.createElement(type);
	if(id) e.setAttribute("id", id);
	if(cl) e.setAttribute("class", cl);
	
	return e;
}

/*
HexViewer 'class'...
options may content:
- nbRows
- div
- addr
- data
*/
function EHXV(options) {
	options = options || {};
	
	this.nbCols = options.cols || 16;			// nb cols to display...
	this.nbRows = options.rows || 64;			// nb rows to display...
	this.addr = options.addr || 0x02001230; 	// start address, decimal...
	this.data = options.data || [];				// full set of data for all frames, string...
	this.index = 0;								// index of data to read...
	this.lastFrameIndex = 0;					// last frame index...
	
	this.loop = false;							// loop through all frames using RAF?
	
	this.knownRanges = [];						// list of known ranges with their info...
	this.watchList = [];						// list of range to watch...
	
	// fps...
	this.setFps(options.fps || 10);				// set wanted fps...
	
	// determine occurence of object to build suffix...
	EHXV.prototype.occurenceCounter++;
	this.suffix = EHXV.prototype.occurenceCounter;
	
	this.div = {
		base: options.div || "hxv",
		address: 	"address" + this.suffix,
		hex: 		"hex" + this.suffix,
		header: 	"hex_header" + this.suffix,
		data: 		"hex_data" + this.suffix,
		text: 		"hex_text" + this.suffix,
		info: 		"hex_info" + this.suffix,
		menu:		"menubar",
		fps:		"fps",
		
		sidebar_data: "sidebar_data",
		sidebar_insp: "sidebar_data_insp",
		sidebar_watch: "sidebar_right",
		
		inspStart: "selectedRange_start",
		inspEnd: "selectedRange_end",
		inspData: "selectedRange_data",
		insp_b: "value_byte_unsigned",
		insp_w: "value_word_unsigned",
		insp_ws: "value_word_signed",
		insp_dw: "value_dword",
	};
	
	// cached div...
	this._cdiv = {
		base: null,
		address: null,
		hex: null,
		header: null,
		data: null,
		text: null,
		info: null,
		menu: null,
		fps: null,
		
		sidebar_data: null,
		sidebar_insp: null,
		sidebar_watch: null,
		
		inspStart: null,
		inspEnd: null,
		inspData: null,
		insp_b: null,
		insp_w: null,
		insp_ws: null,
		insp_dw: null,
	};
	
	// initialisation...
	this.init();
};

// class methods...
EHXV.prototype = {
	// occurence counter to know wich objects structure to use...
	occurenceCounter: 0,
	
	// init structure, cache useful elements, prepare address div...
	init: function() {
		this.initStructure();
		this.initCache();
		this.initHeader();
		this.initEvents();
	},
	
	// cache all useful to have elements...
	initCache: function() {
		var _ = this.div;
		var _c = this._cdiv;
		var d = document;
		
		for(var x in _) _c[x] = d.getElementById(_[x]);
	},
	
	// fps...
	setFps: function(f) { this.fps = f; this.updateIntervalForFps(); },
	updateIntervalForFps: function() { this.intervalFps = 1000 / this.fps; },
	
	// display data...
	displayData: function(t) {
		if(this.loop) this.index++;
		
		if(this.index > this.lastFrameIndex) {
			this.index = 0;
		}
		else if(this.index < 0) {
			this.index = this.lastFrameIndex;
		}
		
		//console.log(this.index, that);
		
		// refresh data display...
		this.displayDataForIndex(this.index);
		
		// we need this little trick to be able to directly call object method...
		
		if(this.loop) {
			var that = this;
			requestAnimationFrame(function() { return that.displayData(); });
		}
	},
	
	// attach events to some keys...
	/*
		- -1	 : 37 (left)
		- +10	 : 38 (up)
		- +1	 : 39 (right)
		- -10	 : 40 (down)
		- first	 : 36 (home)
		- last	 : 35 (end)
		- start/stop : 45 (insert)
	*/
	initEvents: function() {
		// we pass only this cause cause browsers will automatically search for a function called 'handleEvent', and that way, we're able to access object data/methods... 
		document.addEventListener("keyup", this, false);
	},
	
	// that name allow to have this being our EHXV object...
	handleEvent: function(e) {
		var k = e.which;
		
		if(e.shiftKey) {
			if(k === 37) 	  { this.controlStop(); this.index--; 	this.displayData(); }
			else if(k === 38) { this.controlStop(); this.index += 10; this.displayData(); }
			else if(k === 39) { this.controlStop(); this.index++; 	this.displayData(); }
			else if(k === 40) { this.controlStop(); this.index -= 10; this.displayData(); }
			else if(k === 36) { this.controlStop(); this.index = 0; 	this.displayData(); }
			else if(k === 35) { this.controlStop(); this.index = this.lastFrameIndex; this.displayData(); }
			else if(k === 45) { this.controlToggle(); }
		}
		
		//console.log(e.shiftKey, e.which);
	},
	
	controlStart: function() { this.loop = true; this.displayData(); },
	controlStop: function() { this.loop = false; },
	controlToggle: function() { (this.loop)?this.controlStop():this.controlStart(); },
	
	// replace content of hex data...
	displayDataForIndex: function(index) {
		index = index || this.index;
		var data = ((new Date().getTime()) + "x" + this.data[index] || "out of bound index '" + index + "'").match(/.{1,2}/g); // better way possible?
		
		// update each span with proper value...
		// build nbRows div...
		var el = this._cdiv.data.childNodes;
		var i = el.length;
		
		// build new div content...
		for(var k = 0; k < i; k++) {
			if(el[k].id) el[k].firstChild.nodeValue = data[k];
		}
		
		// fps refresh...
		var fps = this._cdiv.fps;
		fps.firstChild.nodeValue = index;
		
		// update watch list...
		this.updateWatchListValues();
	},
	
	// refresh values of watch list if any...
	updateWatchListValues: function() {
		if(this.watchList.length > 0) {
			var wl = this.watchList;
			
			for(var i = 0; i < wl.length; i++) {
				if(wl[i]) wl[i].update();
			}
		}
	},
	
	addToWatchList: function(options) {
		this.watchList.push(new WATCHER(options));
	},
	removeFromWatchList: function(id) {
		this.watchList[id].remove();
		this.watchList[id] = false;
	},
	
	// update data array to display...
	setData: function(addr, data) {
		this.addr = addr || 0;
		
		// refresh address div...
		this.initAddress();
		
		// prepare hex data...
		this.initHexData();
		
		if(data.constructor === Array) {
			this.data = data;
		}
		else {
			this.data = [data];
		}
		
		// check for known ranges...
		this.drawKnownRanges();
		
		this.lastFrameIndex = this.data.length - 1;
	},
	
	// check known ranges and display them on screen...
	drawKnownRanges: function() {
	
	},
	
	// build header...
	initHeader: function() {
		var j = this.nbCols;
		
		for(var i = 0, k = 0; i < j; i++, k++) {
			// each 8, insert a space...
			if(k === 8) {
				this._cdiv.header.appendChild(document.createTextNode(" "));
				k = 0;
			}
			
			var span = document.createElement("span");
			span.appendChild(document.createTextNode(pad(i, 2)));
			this._cdiv.header.appendChild(span);
		}
	},
	
	// build address div...
	initAddress: function() {
		// build nbRows div...
		var j = this.nbRows;
		var addr = this.addr;
		//var div = "addr" + this.suffix + "_";
		
		// delete previous content...
		var el = this._cdiv.address;
		while(el.firstChild) el.removeChild(el.firstChild);
		
		// build new div content...
		for(var i = 0; i < j; i++) {
			var e = document.createElement("div");
			e.appendChild(document.createTextNode("0x" + pad((addr + i * 16).toString(16).toUpperCase(), 8)));
			el.appendChild(e);
		}
	},
	// build hex data div...
	initHexData: function() {
		// build nbRows div...
		var j = this.nbRows;
		var c = this.nbCols;
		var addr = this.addr;
		var id = "data" + this.suffix + "_";
		
		// delete previous content...
		var el = this._cdiv.data;
		while(el.firstChild) el.removeChild(el.firstChild);
		
		// build new div content...
		for(var i = 0; i < j; i++) {
			for(var k = 0; k < c; k++) {
				var e = document.createElement("span");
				e.id = id + (addr + i * 16 + k);
				e.appendChild(document.createTextNode(".."));
				el.appendChild(e);
				
				// each 8, insert a space...
				if(k === 7) el.appendChild(document.createTextNode(" "));
			}
			
			el.appendChild(document.createElement("br"));
		}
	},
	
	// build structure...
	initStructure: function() {
		// container div...
		var d = this.div;
		var base = document.getElementById(d.base);
		
		var addr = newElement("div", d.address, "address");
		var hex = newElement("div", d.hex, "hex");
		var hex_header = newElement("div", d.header, "hex_header");
		var hex_data = newElement("div", d.data, "hex_data");
		hex.appendChild(addr);
		hex.appendChild(hex_data);
		var text = newElement("div", d.text, "hex_text");
		var info = newElement("div", d.info, "hex_info");
		
		base.appendChild(hex_header);
		base.appendChild(hex);
		base.appendChild(text);
		base.appendChild(info);
		
		// create fps div...
		var fps = newElement("div", d.fps, "fps");
		fps.appendChild(document.createTextNode(" "));
		var menu = document.getElementById(d.menu);
		menu.appendChild(fps);
		
		// cache is done next...
	},
	
	updateWithSelectedRange: function() {
		// find all selected...
		var offsetStart, offsetEnd, data;
		var list = this._cdiv.hex.querySelectorAll("span.selected");
		
		if(list.length > 0 && list.length < 8) {
			// read first and last to calculate range...
			var tmp1 = list[0].id.split("_");
			var tmp2 = list[list.length - 1].id.split("_");
			
			// index 1 is row, index 2 is column...
			offsetStart = "0x" + pad(parseInt(tmp1[1]).toString(16).toUpperCase(), 8);
			offsetEnd = "0x" + pad(parseInt(tmp2[1]).toString(16).toUpperCase(), 8);
			
			data = map(list, function(o) { return o.firstChild.nodeValue; });
		}
		else {
			// no selected...
			offsetStart = "";
			offsetEnd = "";
			data = [];
		}
		
		var _ = this._cdiv;
		
		// update values...
		_.inspStart.value = offsetStart;
		_.inspEnd.value = offsetEnd;
		_.inspData.value = data.join("");
		
		// empty inspector fields...
		_.insp_b.value = "";
		_.insp_w.value = "";
		_.insp_ws.value = "";
		_.insp_dw.value = "";
		
		// update values fields...
		var dataFinal = data.join("");
		
		if(data.length == 1) {
			_.insp_b.value = parseInt(dataFinal, 16);
		}
		else if(data.length == 2) {
			_.insp_w.value = hex2signed(dataFinal);
			_.insp_ws.value = parseInt(dataFinal, 16);
		}
		else if(data.length == 4) {
			_.insp_dw.value = "0x" + dataFinal;
		}
	},
	
	
	
	// old code...
	getData: function(addr) {
		$.get("data.json", { addr: addr }).done(function(data) {
			console.log("get data done", data);
			this.data = data.data;
		}).fail(function(a, b, c) { console.log("getData fail", a, b, c); });
	},
	getKnownRanges: function(start, end) {
		this.knownRanges = [
{"id":"1","address":"00000001","length":"1","type":"b","name":"osef","group":"osec","comment":"oseb"},
{"id":"2","address":"00000018","length":"2","type":"bs","name":"osef","group":"osec","comment":"oseb"},
{"id":"3","address":"00000027","length":"2","type":"w","name":"osef","group":"osec","comment":"oseb"},
{"id":"4","address":"0000003b","length":"2","type":"ws","name":"osef","group":"osec","comment":"oseb"},
{"id":"5","address":"00000080","length":"4","type":"dw","name":"osef","group":"osec","comment":"oseb"},
{"id":"5","address":"0200DC50","length":"4","type":"dw","name":"osef","group":"osec","comment":"oseb"},
		                    ];
	},
	checkKnownRanges: function() {
		for(var i in this.knownRanges) {
			var o = this.knownRanges[i];
			
			// find if on screen...
			var addr = o.address;
			var addrDec = parseInt(addr, 16);
			
			if(addrDec >= this.addr && addrDec <= this.addrEnd) {
				var p = [];
				for(var j = 0; j < o.length; j++) p.push("#data_" + (addrDec + j));
				$(p.join(",")).addClass("known_range_" + o.type);
			}
		}
	},
};

function WATCHER(options, index) {
	options = options || {};
	
	this.addr = options.addr || -1;
	this.type = options.type || -1;
	this.type = this.type.toLowerCase();
	this.ehxvIndex = index || 1; // needed to be able to target data divs...
	
	// set size and typeIndex, to make update easier...
	if(this.type == "b") { this.size = 1; this.typeIndex = 0; }
	else if(this.type == "w") { this.size = 2;  this.typeIndex = 1;}
	else if(this.type == "ws") { this.size = 2;  this.typeIndex = 2;}
	else if(this.type == "dw") { this.size = 4;  this.typeIndex = 3;}
	else { this.size = -1;  this.typeIndex = -1; }
	
	if(this.addr != -1 && this.type != -1) {
		WATCHER.prototype.counter++;
		this.number = WATCHER.prototype.counter;
		this.name = options.name || "Watcher #" + this.number;
		this.addrDec = parseInt(this.addr);
		this.setTargetDivs();
		this.init();
		
		this.update();
	}
	else {
		console.log("WATCHER failed to initalize, bad arguments...", options);
	}
};

// class methods...
WATCHER.prototype = {
	container: "sidebar_right",
	counter: -1,
	aTypes: ["b", "w", "ws", "dw"],
	aTypesFunction: [
	                 function(x) {return parseInt(x, 16); }, 
	                 function(x) {return parseInt(x, 16); }, 
	                 function(x) {return hex2signed(x); }, 
	                 function(x) {return x; }, 
	                 ],
	setTargetDivs: function() {
		// determine them by starting at addr for size length...
		this.targetDivs = [];
		var a = this.addrDec;
		
		for(var i = 0; i < this.size; i++, a++) {
			var e = document.getElementById("data" + this.ehxvIndex + "_" + a);
			this.targetDivs.push(e);
		}
	},
	update: function() {
		//read targetdivs and get values...
		var a  = this.targetDivs;
		var n = a.length;
		var v = "0x";
		var t = this.typeIndex;
		
		for(var i = 0; i < n; i++) v += a[i].firstChild.nodeValue;
		
		this._cData.firstChild.nodeValue = this.aTypesFunction[t](v);
	},
	// draw in div...
	init: function() {
		// build elements...
		var div = "watcher_" + this.number;
		var container = newElement("div", div, "watcher");
		var name = newElement("span", null, "watcher_name");
		var data = newElement("span", div + "_data", "watcher_data span_" + this.type.toLowerCase());
		var del = newElement("span", div + "_del", "watcher_del");
		name.appendChild(document.createTextNode(this.name + " (" + this.addr + ")"));
		data.appendChild(document.createTextNode("..."));
		del.appendChild(document.createTextNode("x"));
		container.appendChild(name);
		container.appendChild(data);
		container.appendChild(del);
		
		document.getElementById(this.container).appendChild(container);
		
		this._cData = data;
		this._cContainer = container;
	},
	// remove watcher...
	remove: function() {
		this._cContainer.parentNode.removeChild(this._cContainer);
	},
};
	
	// attach to window to make class available globally...
	window.EHXV = EHXV;
	window.WATCHER = WATCHER;
})(window, document);
