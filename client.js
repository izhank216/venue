var socket = new WebSocket("ws://" + window.location.hostname + ":4821"),
	player = document.getElementById("player");

var title;

socket.onopen = function() {
	console.log("connected");
};

socket.onmessage = function(event) {
	var decompressed = LZString.decompressFromUTF16(event.data);
	var data;

	try {
		data = JSON.parse(decompressed);
	} catch (e) {
		console.error("Failed to parse message", e);
		return;
	}

	if (data.event === 'handshake') {
		title = data.title;
		document.title = data.title;
		document.getElementsByTagName("h1")[0].innerHTML = data.title;
		finishLoading();
		
		var response = JSON.stringify({ event: 'handshake' });
		socket.send(LZString.compressToUTF16(response));
	}

	if (data.event === 'pop') {
		console.log("Received new music: " + data.path);

		var songTitle = data.path.replace("/", "").replace(/\//g, ' &mdash; ').split(".mp3")[0].split(".ogg")[0].split(".wav")[0];

		document.title = songTitle + " at " + title;
		document.getElementById("title").innerHTML = songTitle;

		player.src = window.location.protocol + "//" + window.location.hostname + data.path;
	}
};

socket.onerror = function(error) {
	console.log("[error] WebSocket Error");
	alert("There has been an error with the server, maybe it's down?");
};

socket.onclose = function() {
	console.log("Connection closed");
};

var state = false;

function pause() {
	if (state) {
		document.getElementById("pause").innerHTML = "play";
		player.pause();
	} else {
		document.getElementById("pause").innerHTML = "pause";
		player.play();
	}
	state = !state;
}

function next() {
	document.getElementById("pause").innerHTML = "pause";
	console.log("Sending order to change music");
	
	var message = JSON.stringify({ event: 'next' });
	socket.send(LZString.compressToUTF16(message));

	state = true;
}

function finishLoading() {
	document.getElementById("content").style.display = "block";
	document.getElementById("loading").style.display = "none";
	state = true;
}

window.onload = function() {
	document.getElementById("next").onclick = next;
	document.getElementById("pause").onclick = pause;
	player.addEventListener('loadedmetadata', function() {
		player.play();
	}, false);
	player.addEventListener("ended", next, false);
};
