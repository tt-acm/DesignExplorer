

function unloadPageContent(){
	/*
		// This function removes current contents from the page
		// Only base HTML objects will remain in the page afterwards
		// Use this in case you want to load new data to the page
	*/

	d3.select("div.legend").selectAll("*").remove(); // remove legend

	d3.select("#inputSliders").selectAll("*").remove(); //remove sliders
	d3.select("#inputSliders").append("form").attr("class", "sliders"); // append a form
	
	d3.select("div#graph").selectAll("*").remove(); //remove parallel coord graph

	d3.select("div#thumbnails-btm_container").select("div#sorting").selectAll("*").remove(); // remove sorting drop-down
	d3.select("div#thumbnails-btm_container").select("div#sorting").text("");
	d3.select("div#thumbnails-btm_container").select("div#thumbnails-btm").selectAll("*").remove(); // remove thumbnail images

	d3.select("div#thumbnails-side_container").select("div#sorting").selectAll("*").remove(); // remove thumbnail images
	d3.select("div#thumbnails-side_container").select("div#sorting").text("");
	d3.select("div#thumbnails-side_container").select("div#thumbnails-side").selectAll("*").remove(); // remove thumbnail images

	d3.select("div#zoomed").selectAll("*").remove(); //remove zoomed image if any
	d3.select("div#viewer3d").selectAll("*").remove(); //remove any object inside 3D viewer

}



function overwriteInitialGlobalValues(){
	/*
		// This function initiates all the global values for the page
		// I'm not sure if this is the best practice in javascript (probably it's not)
		// Let me (github.com/mostaphaRoudsari) know if you know a better solution
	*/

	isAnyItemSelected = false;
    isToggled = true;

	originalData, //csv as it is imported
    cleanedData = [], //all the columns to be used for parallel coordinates
    inputData = [],  // columns with input values - to be used for sliders
    outputData = [], // columns with output values - to be used for radar graph
    slidersInfo = [], // {name:'inputName', tickValues : [sorted set of values]},
    currentSliderValues = {}, // collector for values 
    allDataCollector = {},
    slidersMapping = {}, // I collect the data for all the input sliders here so I can use it to remap the sliders later
    ids = []; // Here I collect all data based on a unique ID from inputs

    rcheight = height = d3.select("#graph").style("height").replace("px", "");

    selectedDataFormatted = [];

    firstRating = true; // variable for star rating
}