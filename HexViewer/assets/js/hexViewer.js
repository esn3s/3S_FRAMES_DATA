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

function pad (str, max) {
	str = str.toString();
	return str.length < max ? pad("0" + str, max) : str;
}

function EHV(options) {
	this.nbRows = 16;
	this.knownRanges = []; // list of known ranges with their info...
	options = options || {};
	this.addr = options.addr || 0; // start address, decimal...
	this.addrHex = this.addr.toString(16); // start address, decimal...
	this.data = options.data || ""; // data, string...
	this.size = this.data.length || 1024; // length...
	this.addrEnd = this.addr + this.size;
};

EHV.prototype = {
	updateWithSelectedRange: function(data) {
		// find all selected...
		var offsetStart, offsetEnd, data;
		var list = $("span.selected", "#hex_data");
		
		if(list.length > 0) {
			// read first and last to calculate range...
			var tmp1 = list[0].id.split("_");
			var tmp2 = list[list.length - 1].id.split("_");
			
			// index 1 is row, index 2 is column...
			offsetStart = parseInt(this.addr + tmp1[1]);
			offsetEnd = parseInt(this.addr + tmp2[1]);
			
			offsetStart = "0x" + pad(offsetStart.toString(16), 8);
			offsetEnd = "0x" + pad(offsetEnd.toString(16), 8);
			data = $.map(list, function(o) {
				return o.textContent;
			});
		}
		else {
			// no selected...
			offsetStart = "";
			offsetEnd = "";
			data = [];
		}

		$("#selectedRange_start").val(offsetStart);
		$("#selectedRange_end").val(offsetEnd);
		$("#selectedRange_data").val(data.join(""));
		
		// update values fields...
		if(data.length == 2) {
			$("#value_byte_unsigned").val("hex2udec(" + data + ")");
			$("#value_byte_signed").val("hex2dec(" + data + ")");
		}
		else if(data.length == 4) {
			
		}
		else if(data.length == 8) {
			
		}
	},
	initDivAddress: function() {
		var s = [];
		s.push("<br />\n");
		var size = this.nbRows * 16;
		
		for(var i = 0; i < size; i+=16) {
			s.push("<div id=\"addr_" + i + "\">0x" + pad((this.addr + i).toString(16).toUpperCase(), 8) + "</div>");
		}
		
		$(".address").html(s.join("\n\t"));
		
		console.log("initDivAddress");
	},
	initDivHexData: function() {
		var s = [];
		var size = this.nbRows;
		var a = this.addr;
		
		for(var r = 0; r < size; r++) {
			for(var i = 0, o = r * 16; i < 8; i++, o+=2, a++) s.push("<span id=\"data_" + a + "\">" + this.data[o] + this.data[o + 1] + "</span>");
			s.push("&nbsp;");
			for(var i = 8; i < 16; i++, o+=2, a++) s.push("<span id=\"data_" + a + "\">" + this.data[o] + this.data[o + 1] + "</span>");
			s.push("<br />\n");
		}
		
		$("#hex_data").html(s.join(""));
		
		console.log("initDivHexData");
	},
	initDivHexText: function() {
		
	},
	initDivHexInfo: function() {
		
	},
	loadData: function() {
		this.initDivAddress();
		this.initDivHexData();
		this.initDivHexText();
		this.initDivHexInfo();

		this.getKnownRanges();
		this.checkKnownRanges();
	},
	getData: function(addr) {
		this.addr = addr;// || 0x02000000;
		this.data = "FFC0000E003A000C0000000000000000FFA20016004C0012FFCE001A00320014FFB6001A003E0014000000000000000000000000000000000000000000000000FFA80018004800120000000000000000FFC0002800260020FFCE0018001200120000000000000000000000000000000FFD00020002E0020FFDC00140052003400000000000000000000000000000000FFE00012007600140000000000000000FFD40018003800140000000000000000FFE000100076000E0000000000000000FFDA00100036000E0000000000000000FFBE002E00240024FFD000200010001800000000000000000000000000000000FFC0002C00340024000000000000000000000000000000000000000000000000FFC2002A003C0022000000000000000000000000000000000000000000000000FFC4002800600020000000000000000000000000000000000000000000000000FFB40016002E00120000000000000000FFCC0016003600120000000000000000FFBA00120034000E0000000000000000";
		
		this.loadData();
		
		return;
		
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
