window.onload = function() {
	// Connect to canvas
	canvas = document.getElementById("canvas");
	paper.setup(canvas);
	
	// If resize is set, the canvas size tags are ignored if element size is specified
	// If resize is not set, the canvas size always matches the element size
	// Setting the size programmatically, while odd, is my only means of actually doing supersampling
	// It also leads to a flicker of incorrect size at the start, ugh
	let viewRadius = 4000;
	paper.view.viewSize = new paper.Size(viewRadius, viewRadius);
	canvas.style.height = "70vmin";
	canvas.style.width = "70vmin";
	
	// Create variables
	circle = null;
	render = null;
	
	// Make the background
	let background = new paper.Path.Rectangle(paper.view.viewSize);
	background.fillColor = "white";
	
	// Function definitions
	
	redraw = function() {
		// Clear render (if necessary)
		if (render) {
			render.remove();
		}
		
		// Draw the circle
		render = circle.draw(0, false);
		
		// Rescale and position render
		let viewBounds = paper.view.bounds;
		let rendBounds = render.bounds;
		let factor = Math.min(viewBounds.width/rendBounds.width, viewBounds.height/rendBounds.height);
		render.scale(factor);
		render.translate(paper.view.center.subtract(render.bounds.center));
		paper.view.draw();
		
		// Update costs
		showCost();
	}
	
	showCircle = function(c) {
		circle = c;
		redraw();
	}

	paper.view.onResize = function(event) {
		redraw();
	}
	
	// Below functions are specific to the "tech demo" and may be changed in the full version

	download = function(filename){
		var link = document.createElement('a');
		link.download = filename + ".png";
		link.href = document.getElementById('canvas').toDataURL()
		link.click();
	}
	
	convert = function(shouldDownload=false) {
		let inputText = document.getElementById("inputText").value.replaceAll(" ", "");
		try {
			showCircle(parseArray(inputText));
			showCost();
			if (shouldDownload) {
				download(inputText);
				showStatus("Parsed " + inputText + ", image downloaded.");
			}
			else {
				showStatus("Parsed " + inputText);
			}
		}
		catch (error) {
			console.error(error);
			showStatus("Error. Check spelling and parenthesis carefully. ");
		}
	}
	
	showCost = function() {
		document.getElementById("rawcost").innerText = fullCost(circle) + "E";
		document.getElementById("cost").innerText = fullCost(circle) + "E";
	}
	
	convertAndDownload = function() {
		convert(true);
	}
	
	showStatus = function(string) {
		document.getElementById("status").innerText = string;
	}
	
	// Initial example
	showCircle(parseArray("Ve/Pu/Bk++"));
	showStatus("Converter ready.");
}

