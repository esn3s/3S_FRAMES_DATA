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
