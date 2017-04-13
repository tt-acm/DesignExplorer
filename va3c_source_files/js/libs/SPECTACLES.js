//The MIT License (MIT)
//
//Copyright (c) 2015 Thornton Tomasetti, Inc.
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//THE SOFTWARE.



//base application object containing Spectacles functions and properties
var SPECTACLES = function (divToBind, jsonFileData, callback) {

    var SPECT = this;        //a local app object we can work with inside of the constructor to avoid 'this' confusion.
    SPECT.viewerDiv = divToBind;  //a reference to the div for use throughout the app

    SPECT.scene = {};          //the THREE.js scene object
    SPECT.jsonLoader = {};     //the object that will take care of loading a THREE.js scene from a json file
    SPECT.boundingSphere = undefined;      //a sphere that encompasses everything in the scene
    SPECT.lightingRig = {};    //a parent object to hold our lights.  We'll be setting properties with UI
    SPECT.orbitControls = {};  //the THREE.js orbit controls object
    SPECT.camera = {};         //the THREE.js camera object
    SPECT.renderer = {};       //the THREE.js renderer object
    SPECT.clock = {};          //the THREE.js clock
    SPECT.stats = undefined;               //the Stats object
    SPECT.backgroundColor = 0xFFFFFF;


    //*********************
    //*********************
    //*** THREE.js setup

    //function that sets up the initial THREE.js scene, renderer, camera, orbit controls, etc.
    //also creates loading and blackout divs which are shown/hidden as json files are loaded
    SPECT.initViewer = function (viewerDiv) {

        //append the blackout div and let it respond to the parent div resizing
        SPECT.viewerDiv.append("<div class='Spectacles_blackout'></div>");
        //function to position and size the blackout div
        var setBlackout = function () {
            //set the position of the UI relative to the viewer div
            var targetDiv = $('.Spectacles_blackout');

            //get upper left coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = SPECT.viewerDiv.offset().left - win.scrollLeft();
            var y = SPECT.viewerDiv.offset().top - win.scrollTop();

            //set the position and size
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', y.toString() + "px");
            targetDiv.css('width', SPECT.viewerDiv.width().toString() + "px");
            targetDiv.css('height', SPECT.viewerDiv.height().toString() + "px");
        };
        //call this the first time through
        setBlackout();
        //respond to resize of the parent div
        SPECT.viewerDiv.resize(function () {
            setBlackout();
        });


        //append the loading div and let it respond to the parent div resizing
        SPECT.viewerDiv.append("<div class='Spectacles_loading'><h1>Loading Spectacles .json file...</h1></div>");
        //function to position the loading div
        var setLoading = function () {

            //set the position of the UI relative to the viewer div
            var targetDiv = $('.Spectacles_loading');

            //get upper left coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = ((SPECT.viewerDiv.offset().left + SPECT.viewerDiv.outerWidth()) - win.scrollLeft()) / 2;
            var y = ((SPECT.viewerDiv.offset().top + SPECT.viewerDiv.outerHeight()) - win.scrollTop()) / 2;

            //set the position and size
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', y.toString() + "px");
        };
        //call this the first time through
        setLoading();
        //respond to resize of the parent div
        SPECT.viewerDiv.resize(function () {
            setLoading();
        });


        //append a footer.  Feel free to strip this out if you'd like to! ;]
        SPECT.viewerDiv.append(
            "<div class='Spectacles_Footer'>" +
            "<img src='https://raw.githubusercontent.com/tt-acm/Spectacles.WebViewer/gh-pages/docs/SPECTACLES_20px.png'> " +
            "Spectacles is developed by the <a href='http://core.thorntontomasetti.com/' target='blank'>CORE studio</a>.  " +
            "Copyright <a href='http://thorntontomasetti.com/' target='blank'>Thornton Tomasetti</a> 2015." +
            "</div>");
        //function to position footer
        var setFooter = function(){
            //set the position of the UI relative to the viewer div
            var targetDiv = $('.Spectacles_Footer');

            //get lower right coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = SPECT.viewerDiv.offset().left - win.scrollLeft();
            var y = (SPECT.viewerDiv.offset().top - win.scrollTop()) + SPECT.viewerDiv.height();

            //set the position
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', (y - 25).toString() + "px");
        };
        //call the first time through
        setFooter();
        //respond to resize of the parent div
        SPECT.viewerDiv.resize(function () {
            setFooter();
        });

        //empty scene
        SPECT.scene = new THREE.Scene();

        //set up the THREE.js div and renderer
        SPECT.container = viewerDiv;
        SPECT.renderer = new THREE.WebGLRenderer(
            {
                maxLights: 10,
                antialias: true
            }
        );
        SPECT.renderer.setClearColor(SPECT.backgroundColor, 1.0);
        SPECT.renderer.setSize(viewerDiv.innerWidth(), viewerDiv.innerHeight());
        SPECT.renderer.shadowMapEnabled = true;
        SPECT.container.append(SPECT.renderer.domElement);

        //set up the camera and orbit controls
        SPECT.camera = new THREE.PerspectiveCamera(45, viewerDiv.innerWidth() / viewerDiv.innerHeight(), 1, 1000000);
        SPECT.camera.position.set(1000, 1000, 1000);
        SPECT.orbitControls = new THREE.OrbitControls(SPECT.camera, SPECT.renderer.domElement);
        SPECT.orbitControls.target.set(0, 100, 0);

        //a clock.  the camera uses this
        SPECT.clock = new THREE.Clock();

        //respond to resize
        viewerDiv.resize(function () {
            var WIDTH = viewerDiv.innerWidth(),
                HEIGHT = viewerDiv.innerHeight();
            SPECT.renderer.setSize(WIDTH, HEIGHT);
            SPECT.orbitControls.object.aspect = WIDTH / HEIGHT;
            SPECT.orbitControls.object.updateProjectionMatrix();
        });

        //respond to window resize and scrolling.  when the window resizes, sometimes it moves our parent div ... and all of our
        //children need to be repositioned (maybe I'm just horrible with CSS?).  On a resize, trigger the resize
        //event on our parent DIV, which should reposition all of the children.
        window.addEventListener('resize', function () {
            SPECT.viewerDiv.resize();
        });
        window.addEventListener('scroll', function () {
            SPECT.viewerDiv.resize();
        });


        //call the render function - this starts the webgl render loop
        SPECT.render();
    };

    //function that starts the THREE.js renderer
    SPECT.render = function () {
        if (SPECT.stats !== undefined) {
            SPECT.stats.update();
        }
        var delta = SPECT.clock.getDelta();
        SPECT.orbitControls.update(delta); //getting a warning here - look into it

        requestAnimationFrame(SPECT.render); // same here - look into this warning
        SPECT.renderer.render(SPECT.scene, SPECT.orbitControls.object);
    };

    //*********************
    //*********************
    //*** TOP LEVEL FUNCTION CALLS
    //these are called from outside and enable / disable chunks of application functionality and UI

    //**********************TOP LEVEL METHOD!!!**********************************
    //this is the method that is called to initialize the dat.GUI user interface.
    SPECT.userInterface = function () {

        //append a child div to our parent and use the child to host the dat.GUI controller
        $('body').append('<div class="Spectacles_uiTarget"></div>');

        //function to position the target div relative to the parent
        var positionGuiDiv = function () {
            //set the position of the UI relative to the viwer div
            var targetDiv = $('.Spectacles_uiTarget');

            //get upper right coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = (SPECT.viewerDiv.offset().left - win.scrollLeft()) + SPECT.viewerDiv.width();
            var y = SPECT.viewerDiv.offset().top - win.scrollTop();

            //set the position
            targetDiv.css('left', (x - 310).toString() + "px");
            targetDiv.css('top', y.toString() + "px");
        }
        positionGuiDiv();

        //respond to resize of Parent div
        SPECT.viewerDiv.resize(function () {
            positionGuiDiv();
        });

        //initialize the Dat.GUI object, and bind it to our target div
        SPECT.uiVariables = new SPECT.UiConstructor();
        SPECT.datGui = new dat.GUI({ autoPlace: false });
        SPECT.datGui.width = 300;
        $('.Spectacles_uiTarget').append(SPECT.datGui.domElement);



        //hide the dat.gui close controls button
        //$(".close-button").css('visibility', 'hidden');


        //Jquery UI stuff - make divs draggable, resizable, etc.

        //make the attributes div draggable and resizeable
        //$('.Spectacles_attributeList').draggable({ containment: "parent" });
        //$('.attributeList').resizable();

    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable the file open UI.
    SPECT.openLocalFiles = function () {

        //function to position the loading div
        var setFileOpen = function () {

            //set the position of the UI relative to the viewer div
            var targetDiv = $('.Spectacles_openFile');

            //get upper left coordinates of the viewer div - we'll use these for positioning
            var x = (SPECT.viewerDiv.position().left + SPECT.viewerDiv.width()) / 2;
            var y = (SPECT.viewerDiv.position().top + SPECT.viewerDiv.height()) / 2;

            //set the position and size
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', y.toString() + "px");
        };
        //call this the first time through
        setFileOpen();
        //respond to resize of the parent div
        SPECT.viewerDiv.resize(function () {
            setFileOpen();
        });

        //add a file folder containing the file open button
        var fileFolder = SPECT.datGui.addFolder('File');
        SPECT.UIfolders.File = fileFolder;
        fileFolder.add(SPECT.uiVariables, 'openLocalFile').name("Open Spectacles Files");
        //fileFolder.add(SPECT.uiVariables, 'openUrl'); //not working yet - commenting out for now

        //make the file open divs draggable
        //$(".Spectacles_openFile").draggable({ containment: "parent" });
    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable the Scene UI
    SPECT.sceneUI = function () {
        //add scene folder
        var sceneFolder = SPECT.datGui.addFolder('Scene');
        SPECT.UIfolders.Scene = sceneFolder;
        //background color control
        sceneFolder.addColor(SPECT.uiVariables, 'backgroundColor')
            .listen()
            .onChange(function (e) {
            //set background color
            SPECT.renderer.setClearColor(e);
        });
        //scene fog
        //sceneFolder.add(SPECT.uiVariables, 'fog').onChange(function(e){
        //        Spectacles.lightingRig.setFog(e);
        //    });

        //append a new div to the parent to use for stats visualization
        SPECT.viewerDiv.append("<div id='Spectacles_stats' style= 'position: fixed;'></div>");

        //set up the stats window
        SPECT.stats = new Stats();
        SPECT.stats.domElement.style.cssText = 'opacity: 0.5; position: fixed; ';
        $('#Spectacles_stats').append(SPECT.stats.domElement);

        //position the stats relative to the parent
        var positionStats = function () {
            //set the position of the UI relative to the viewer div
            var targetDiv = $('#Spectacles_stats');

            //get lower right coordinates of the viewer div - we'll use these for positioning
            //get upper left coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = (SPECT.viewerDiv.offset().left - win.scrollLeft()) + SPECT.viewerDiv.width();
            var y = (SPECT.viewerDiv.offset().top - win.scrollTop()) + SPECT.viewerDiv.height();

            //set the position
            targetDiv.css('left', (x - 77).toString() + "px");
            targetDiv.css('top', (y - 48).toString() + "px");
        };
        positionStats();

        //hide the stats the first time through.
        $('#Spectacles_stats').hide();


        //respond to resize
        SPECT.viewerDiv.resize(function () {
            positionStats();
        });

        //create the controller in the UI
        SPECT.UIfolders.Scene.add(SPECT.uiVariables, 'showStats').onChange(function (e) {
            if (e) {
                $('#Spectacles_stats').show();
            }
            else {
                $('#Spectacles_stats').hide();
            }
        });
    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable the Lighting UI
    SPECT.lightingUI = function () {
        //add a lighting folder
        var lightsFolder = SPECT.datGui.addFolder('Lighting');
        SPECT.UIfolders.Lighting = lightsFolder;
        //light colors
        lightsFolder.addColor(SPECT.uiVariables, 'ambientLightColor').onChange(function (e) {
            SPECT.lightingRig.setAmbientLightColor(e);
        });
        lightsFolder.addColor(SPECT.uiVariables, 'pointLightsColor').onChange(function (e) {
            SPECT.lightingRig.setPointLightsColor(e);
        });
        lightsFolder.add(SPECT.uiVariables, 'shadows').onChange(function (e) {
            SPECT.lightingRig.shadowsOnOff(e);
        });
        /*//solar az and alt
         lightsFolder.add(SPECT.uiVariables, 'solarAzimuth')
         .min(0)
         .max(359)
         .step(1);
         lightsFolder.add(SPECT.uiVariables, 'solarAltitude')
         .min(0)
         .max(90)
         .step(0.1);*/
    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable view and selection UI
    SPECT.viewAndSelectionUI = function () {
        //add view folder
        var viewFolder = SPECT.datGui.addFolder('View_and_Selection');
        SPECT.UIfolders.View_and_Selection = viewFolder;
        //zoom extents and selected
        viewFolder.add(SPECT.uiVariables, 'zoomExtents');
        viewFolder.add(SPECT.uiVariables, 'zoomSelected');
        //change color of selected object's material
        viewFolder.addColor(SPECT.uiVariables, 'selectedObjectColor').onChange(function (e) {
            SPECT.attributes.setSelectedObjectColor(e);
        });

        //initialize object selection and attributes display
        SPECT.attributes.init();
    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable the view dropdown UI
    SPECT.viewsUI = function () {
        SPECT.views.viewsEnabled = true;
        if (SPECT.views.viewList.length !== 0) {
            SPECT.views.purge();
        }
        SPECT.views.getViews();
        SPECT.views.CreateViewUI();

    };

    //**********************TOP LEVEL METHOD!!!**********************************
    //call this method to enable the view dropdown UI
    SPECT.layersUI = function () {
        SPECT.layers.layersEnabled = true;
        if (SPECT.layers.layerList.length !== 0) {
            SPECT.layers.purge();
        }
        SPECT.layers.getLayers();
        SPECT.layers.CreateLayerUI();
    };




    //*********************
    //*********************
    //*** JSON Model Loader

    //a function to open a file from disk
    //found this method here: http://www.javascripture.com/FileReader
    SPECT.jsonLoader.openLocalFile = function (event) {
       
        //the input object
        var input = event.target;

        //a new filereader object and onload callback
        var reader = new FileReader();
        reader.onload = function () {

            //data variable to populate
            var data = null;

            try { //get the json data
                data = $.parseJSON(reader.result);
            } catch (e) {
                console.log("something went wrong while trying to parse the json data.");
                console.log(e);
                return;
            }

            try { //load the json data into the scene

                if (data !== null) {
                    SPECT.jsonLoader.loadSceneFromJson(data);
                    SPECT.zoomExtents();
                    SPECT.views.storeDefaultView();
                }


            } catch (e) {
                console.log("something went wrong while trying to load the json data.");
                console.log(e);
            }
        };

        //read the file as text - this will fire the onload function above when a user selects a file
        reader.readAsText(input.files[0]);

        //hide the input form and blackout
        $("#OpenLocalFile").css("visibility", "hidden");
        $(".Spectacles_loading").show();
    };

    SPECT.jsonLoader.clearFile = function (event) {
        //the input object
        var input = event.target;
        input.value = "";

    };

    //function to open a file from url
    SPECT.jsonLoader.openUrl = function (url) {

        //hide form, show loading
        $("#OpenLocalFile").css("visibility", "hidden");
        $(".Spectacles_loading").show();

        //try to parse the json and load the scene
        try {
            $.getJSON(url, function (data) {
                try {
                    //call our load scene function
                    SPECT.jsonLoader.loadSceneFromJson(data);
                    SPECT.zoomExtents();
                    SPECT.views.storeDefaultView();
                } catch (e) {
                    $(".Spectacles_loading").hide();
                    $(".Spectacles_blackout").hide();
                    console.log("Spectacles load a scene using the json data from the URL you provided!  Here's the error:");
                    console.log(e);
                }
            })
                //some ajax errors don't throw.  this catches those errors (i think)
                .fail(function(){
                    $(".Spectacles_loading").hide();
                    $(".Spectacles_blackout").hide();
                    console.log("Spectacles could not get a json file from the URL you provided - this is probably a security thing on the json file host's end.");
                });
        } catch (e) {
            $(".Spectacles_loading").hide();
            $(".Spectacles_blackout").hide();
            console.log("Spectacles could not get a json file from the URL you provided!  Here's the error:");
            console.log(e);
        }
    };

    //function to hide the 'open file' dialogs.
    SPECT.jsonLoader.hideOpenDialog = function () {
        //hide the input form
        $(".Spectacles_openFile").css("visibility", "hidden");
    };

    //a function to populate our scene object from a json file
    SPECT.jsonLoader.loadSceneFromJson = function (jsonToLoad) {

        //show the blackout and loading message
        $(".Spectacles_blackout").show();
        $(".Spectacles_loading").show();

        //restore the initial state of the top level application objects
        if (SPECT.attributes.elementList.length > 0) {
            SPECT.attributes.purge();
        }
        if (SPECT.lightingRig.pointLights.length > 0) {
            SPECT.lightingRig.purge();
        }
        if (SPECT.views.viewList.length > 0) {
            SPECT.views.purge();
        }
        if (SPECT.layers.layerList.length > 0) {
            SPECT.layers.purge();
        }

        //parse the JSON into a THREE scene
        var loader = new THREE.ObjectLoader();
        SPECT.scene = new THREE.Scene();
        SPECT.scene = loader.parse(jsonToLoad);
        //SPECT.scene.fog = new THREE.FogExp2(0x000000, 0.025);

        //call helper functions
        SPECT.jsonLoader.makeFaceMaterialsWork();
        SPECT.jsonLoader.processSceneGeometry();
        SPECT.jsonLoader.computeBoundingSphere();
        //SPECT.zoomExtents();
        //SPECT.views.storeDefaultView();

        //set up the lighting rig
        SPECT.lightingRig.createLights();//note - i think we should check to see if there is an active lighting UI and use those colors to init lights if so...

        //if those chunks have been enabled by the outside caller, call getViews and getLayers on the scene.
        if (SPECT.views.viewsEnabled) {
            //TO DO --- if a view with the same name as the open view exists in the incoming file, set that view
            SPECT.views.getViews();
            SPECT.views.CreateViewUI();
        }
        if (SPECT.layers.layersEnabled) {
            SPECT.layers.getLayers();
            SPECT.layers.CreateLayerUI();
        }

        //hide the blackout
        $(".Spectacles_blackout").hide();
        $(".Spectacles_loading").hide();

    };

    //a function to add a textured obj/mtl pair to a scene
    SPECT.jsonLoader.addObjMtlToScene = function (objPath, mtlPath, zoomExtentsAfterLoad){
        //hide the blackout
        $(".Spectacles_blackout").show();
        $(".Spectacles_loading").show();

        //new objmtl loader object
        var loader = new THREE.OBJMTLLoader();

        //try to load the pair
        loader.load(objPath, mtlPath,
            function(loadedObj){

                //we need to mirror the objects coming in around the X axis and the Z
                var mat = (new THREE.Matrix4()).identity();
                mat.elements[0] = -1;
                mat.elements[10] = -1;

                //process the loaded geometry - make sure faces are 2 sided, merge vertices and compute, etc
                for(var i=0; i<loadedObj.children.length; i++){
                    if(loadedObj.children[i] instanceof THREE.Mesh){

                        //apply the matrix to accurately position the mesh
                        loadedObj.children[i].geometry.applyMatrix(mat);

                        //replace phong material with Lambert.  Phonga don't play so nice with our lighting setup
                        var lambert = new THREE.MeshLambertMaterial();
                        lambert.map = loadedObj.children[i].material.map;
                        loadedObj.children[i].material = lambert;

                        //set up for transparency
                        loadedObj.children[i].material.side = 2;
                        loadedObj.children[i].material.transparent = true;
                        loadedObj.children[i].material.opacity = 1;
                    }
                    if(loadedObj.children[i] instanceof THREE.Object3D){
                        //loop over the children of the object
                        for(var j=0; j<loadedObj.children[i].children.length; j++){
                            //apply the matrix to accurately position the mesh
                            loadedObj.children[i].children[j].geometry.applyMatrix(mat);

                            //replace phong material with Lambert.  Phonga don't play so nice with our lighting setup
                            var lambert = new THREE.MeshLambertMaterial();
                            lambert.map = loadedObj.children[i].children[j].material.map;
                            loadedObj.children[i].children[j].material = lambert;

                            //set up for transparency
                            loadedObj.children[i].children[j].material.side = 2;
                            loadedObj.children[i].children[j].transparent = true;
                            loadedObj.children[i].children[j].opacity = 1;
                        }
                    }
                }

                //add our loaded object to the scene
                SPECT.scene.add(loadedObj);

                //update lights
                SPECT.jsonLoader.computeBoundingSphere();
                SPECT.lightingRig.updateLights();

                //zoom extents?
                if(zoomExtentsAfterLoad) { SPECT.zoomExtents(); }


                //hide the blackout
                $(".Spectacles_blackout").hide();
                $(".Spectacles_loading").hide();
            },

            // Function called when downloads progress
            function ( xhr ) {
                //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
            },

            // Function called when downloads error
            function ( er ) {
                //console.log( 'An error happened' );
            }
        );
    };

    //call this function to set a geometry's face material index to the same index as the face number
    //this lets meshfacematerials work - the json loader only gets us part of the way there (I think we are missing something when we create mesh faces...)
    SPECT.jsonLoader.makeFaceMaterialsWork = function () {

        for (var i = 0, iLen = SPECT.scene.children.length, items; i < iLen; i++) {
            items = SPECT.scene.children;
            if (items[i].hasOwnProperty("geometry")) {

                //the object to revise
                var geo = items[i].geometry;
                var currentMat = items[i].material;
                var userData = items[i].userData;

                //if this is a face materials object, make all of the mesh faces point to the correct material
                if (currentMat.hasOwnProperty("materials") && userData.hasOwnProperty("Spectacles_FaceColorIndexes")) {

                    //get the 'Spectacles_FaceColorIndexes' string out of the mesh's user data object,
                    //and break it into an array of face material indexes
                    var faceColors = userData.Spectacles_FaceColorIndexes.split(",");

                    //loop over the faces in the geometry and make the face.materialIndex reference the face's index
                    for (var j in geo.faces) {
                        geo.faces[j].materialIndex = faceColors[j];
                    }
                    //tell three.js to update the element in the render loop
                    geo.elementsNeedUpdate = true;

                    //remove the Spectacles_FaceColorIndexes property from the userdata object
                    delete userData['Spectacles_FaceColorIndexes'];
                }
            }
        }
    };

    //function that loops over the geometry in the scene and makes sure everything
    //renders correctly and can be selected
    SPECT.jsonLoader.processSceneGeometry = function () {

        //get all of the items in the scene
        items = SPECT.scene.children;

        //loop over all of the elements and process any geometry objects
        for (var i = 0, iLen = SPECT.scene.children.length, items; i < iLen; i++) {

            //if this is a single mesh (like ones that come from grasshopper), process the geometry and add the
            //element to the attributes elements list so selection works.
            if (items[i].hasOwnProperty("geometry")) {
                //three.js stuff
                items[i].geometry.mergeVertices();
                items[i].geometry.computeFaceNormals();
                items[i].geometry.computeVertexNormals();
                items[i].castShadow = true;
                items[i].receiveShadow = true;
                //add element to our list of elements that can be selected
                //items[i].material.transparent = true;
                //items[i].material.opacity = 1.0;
                SPECT.attributes.elementList.push(items[i]);


            }
                //if this is an object that contains multiple meshes (like the objects that come from Revit), process the
                //children meshes so they render correctly, and add the child to the attributes.elementList
            else if (items[i].children.length > 0) {
                //let the objects cast and receive shadows
                items[i].castShadow = true;
                items[i].receiveShadow = true;
                //the children to loop over
                var itemsChildren = items[i].children;
                for (var k = 0, kLen = itemsChildren.length; k < kLen; k++) {
                    if (itemsChildren[k].hasOwnProperty("geometry")) {
                        itemsChildren[k].geometry.mergeVertices();
                        itemsChildren[k].geometry.computeFaceNormals();
                        itemsChildren[k].geometry.computeVertexNormals();
                        itemsChildren[k].material.side = 2;
                        itemsChildren[k].castShadow = true;
                        itemsChildren[k].receiveShadow = true;
                        //itemsChildren[k].material.transparent = true;
                        //itemsChildren[k].material.opacity = 1.0;
                        SPECT.attributes.elementList.push(itemsChildren[k]);

                    }
                }
            }
        }
    };

    //function to compute the bounding sphere of the model
    //we use this for the zoomExtents function and in the createLights function below
    SPECT.jsonLoader.computeBoundingSphere = function () {
        //loop over the children of the THREE scene, merge them into a mesh,
        //and compute a bounding sphere for the scene
        var geo = new THREE.Geometry();
        SPECT.scene.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                geo.merge(child.geometry);
            }
        });
        geo.computeBoundingSphere();

        //expand the scope of the bounding sphere
        SPECT.boundingSphere = geo.boundingSphere;

        //for debugging - show the sphere in the scene
        //var sphereGeo = new THREE.SphereGeometry(geo.boundingSphere.radius);
        //var sphereMesh = new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({color: 0xffffff, transparent: true, opacity: 0.25}));
        //sphereMesh.position.set(geo.boundingSphere.center.x,geo.boundingSphere.center.y,geo.boundingSphere.center.z);
        //SPECT.scene.add(sphereMesh);
    };



    //zoom extents function.  we call this when we load a file (and from the UI), so it shouldn't be in the UI constructor
    SPECT.zoomExtents = function () {

        if (SPECT.boundingSphere === undefined) SPECT.computeBoundingSphere();

        //get the radius of the sphere and use it to compute an offset.  This is a mashup of theo's method
        //and the one we use in platypus
        var r = SPECT.boundingSphere.radius;
        var offset = r / Math.tan(Math.PI / 180.0 * SPECT.orbitControls.object.fov * 0.5);
        var vector = new THREE.Vector3(0, 0, 1);
        var dir = vector.applyQuaternion(SPECT.orbitControls.object.quaternion);
        var newPos = new THREE.Vector3();
        dir.multiplyScalar(offset * 1.25);
        newPos.addVectors(SPECT.boundingSphere.center, dir);
        SPECT.orbitControls.object.position.set(newPos.x, newPos.y, newPos.z);
        SPECT.orbitControls.target = new THREE.Vector3(SPECT.boundingSphere.center.x, SPECT.boundingSphere.center.y, SPECT.boundingSphere.center.z);
    };

    //set background color function.  we need this at the top level so a user can set the color of her (embedded) viewer without
    //editing our library or using our UI.
    SPECT.setBackgroundColor = function (hexColor) {
        //set top level app variable
        SPECT.backgroundColor = hexColor;
        //update renderer
        SPECT.renderer.setClearColor(SPECT.backgroundColor);
        //update internal variable
        SPECT.uiVariables.backgroundColor = SPECT.backgroundColor;
    };

    //Top level function to open a json file - As requested by Mostapha.  Essentially a wrapper for Spectacles.jsonLoader.loadSceneFromJson
    SPECT.loadNewModel = function (jsonData) {
        SPECT.jsonLoader.loadSceneFromJson(jsonData);
    };





    //*********************
    //*********************
    //*** Lighting

    //ambient light for the scene
    SPECT.lightingRig.ambientLight = {};

    //a spotlight representing the sun
    SPECT.lightingRig.sunLight = {};

    //an array of point lights to provide even coverage of the scene
    SPECT.lightingRig.pointLights = [];

    //function that creates lights in the scene
    SPECT.lightingRig.createLights = function () {

        // create ambient light
        SPECT.lightingRig.ambientLight = new THREE.AmbientLight(0x696969);
        SPECT.scene.add(SPECT.lightingRig.ambientLight);


        //using the bounding sphere calculated above, get a numeric value to position the lights away from the center
        var offset = SPECT.boundingSphere.radius * 2;

        //get the center of the bounding sphere.  we'll use this to center the rig
        var center = SPECT.boundingSphere.center;


        //create a series of pointlights

        //directly above
        var pointA = new THREE.PointLight(0x666666, 1, 0);
        pointA.position.set(center.x, center.y + offset, center.z);
        pointA.castShadow = false;
        SPECT.scene.add(pointA);
        SPECT.lightingRig.pointLights.push(pointA);

        //directly below
        var pointB = new THREE.PointLight(0x666666, 0.66, 0);
        pointB.position.set(center.x, center.y - offset, center.z);
        pointB.castShadow = false;
        SPECT.scene.add(pointB);
        SPECT.lightingRig.pointLights.push(pointB);


        //4 from the cardinal directions, at roughly 45deg
        var pointC = new THREE.PointLight(0x666666, 0.33, 0);
        pointC.position.set(center.x + offset, center.y, center.z);
        pointC.castShadow = false;
        SPECT.scene.add(pointC);
        SPECT.lightingRig.pointLights.push(pointC);

        var pointD = new THREE.PointLight(0x666666, 0.33, 0);
        pointD.position.set(center.x, center.y, center.z + offset);
        pointD.castShadow = false;
        SPECT.scene.add(pointD);
        SPECT.lightingRig.pointLights.push(pointD);

        var pointE = new THREE.PointLight(0x666666, 0.33, 0);
        pointE.position.set(center.x - offset, center.y, center.z);
        pointE.castShadow = false;
        SPECT.scene.add(pointE);
        SPECT.lightingRig.pointLights.push(pointE);

        var pointF = new THREE.PointLight(0x666666, 0.33, 0);
        pointF.position.set(center.x, center.y, center.z - offset);
        pointF.castShadow = false;
        SPECT.scene.add(pointF);
        SPECT.lightingRig.pointLights.push(pointF);



        //directional light - the sun
        var light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(center.x + offset, center.y + offset, center.z + offset);
        light.target.position.set(center.x, center.y, center.z);
        //light.castShadow = true;
        light.shadowCameraNear = 1;
        light.shadowCameraFar = offset * 2.5;
        light.shadowCameraTop = offset * 1.2;
        light.shadowCameraRight = offset * 1.2;
        light.shadowCameraBottom = offset * -1.2;
        light.shadowCameraLeft = offset * -1.2;
        light.distance = 0;
        light.intensity = 0;
        light.shadowBias = 0.001;
        light.shadowMapHeight = SPECT.viewerDiv.innerHeight();
        light.shadowMapWidth = SPECT.viewerDiv.innerWidth();
        light.shadowDarkness = 0.65;
        //light.shadowCameraVisible = true;

        //add the light to our scene and to our app object
        SPECT.lightingRig.sunLight = light;
        SPECT.scene.add(light);

    };

    //function to update lights in the scene.
    //should be called when new geometry is added to a running scene (.obj for instance)
    SPECT.lightingRig.updateLights = function () {

        //remove lights from scene
        SPECT.scene.remove(this.ambientLight);
        SPECT.scene.remove(this.sunLight);
        for(var i=0; i<this.pointLights.length; i++){
            SPECT.scene.remove(this.pointLights[i]);
        }

        //call purge and create
        this.purge();
        this.createLights();

        //call update materials - this counts as a deep update for sure!
        this.updateSceneMaterials();
    };

    //function that adjusts the point lights' color
    //this is a handler for a UI variable
    SPECT.lightingRig.setPointLightsColor = function (col) {

        for (var i in SPECT.lightingRig.pointLights) {

            SPECT.lightingRig.pointLights[i].color = new THREE.Color(col);
        }
    };

    //function that adjusts the ambient light color
    //another handler for a UI element
    SPECT.lightingRig.setAmbientLightColor = function (col) {
        //console.log(col);

        //remove the old ambient light
        SPECT.scene.remove(SPECT.lightingRig.ambientLight);

        //replace the ambient light with a new one, and add it to the scene
        SPECT.lightingRig.ambientLight = new THREE.AmbientLight(new THREE.Color(col));
        SPECT.scene.add(SPECT.lightingRig.ambientLight);


    };

    //function that sets the position of the directional light (the sun)
    SPECT.lightingRig.setSunPosition = function (az, alt) {

    };

    //function to turn the sun on and off
    SPECT.lightingRig.shadowsOnOff = function (shad) {
        if (shad) {
            SPECT.lightingRig.sunLight.castShadow = true;
            SPECT.lightingRig.sunLight.intensity = 1;
            SPECT.lightingRig.updateSceneMaterials();
        }
        else {
            SPECT.lightingRig.sunLight.castShadow = false;
            SPECT.lightingRig.sunLight.intensity = 0;
            SPECT.lightingRig.updateSceneMaterials();
        }
    };

    //function that sets the fog amount in the scene
    //doesn't seem like this should live in the lighting rig ... if we get more scene variables we may need a sceneFunctions
    //object or something.
    SPECT.lightingRig.setFog = function (n) {

        //if false, set fog to null and return
        if (!n) {
            SPECT.scene.fog = null;
        }

            //if true, set up some fog in the scene using the backgound color and the bounding sphere's radius
        else {
            SPECT.scene.fog = new THREE.FogExp2(new THREE.Color(SPECT.uiVariables.backgroundColor), 0.00025);
        }

    };

    //function to traverse materials in the scene when deep updates are needed - fog on off/ shadows on / off, etc
    SPECT.lightingRig.updateSceneMaterials = function () {
        SPECT.scene.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material.needsUpdate = true;
            }
            else if (child.type === 'Object3D') {
                try {
                    for (var i = 0; i < child.children.length; i++) {
                        for (var j = 0; j < child.children[i].children.length; j++) {
                            child.children[i].children[j].material.needsUpdate = true;
                        }
                    }
                } catch (e) { }
            }
        });
    };

    //function to purge lighting variables.  called when we load a new scene
    SPECT.lightingRig.purge = function () {
        this.ambientLight = {};
        this.sunLight = {};
        this.pointLights = [];
    };





    //*********************
    //*********************
    //*** User Interface.

    //dat.gui Constructor object
    // an instance of this is class created to store UI variables and functions
    SPECT.UiConstructor = function () {

        //OPEN FILE
        this.openLocalFile = function () {

            //If an object is selected, this will make sure to hide the attributes. 
            SPECT.attributes.attributeListDiv.hide("slow");

            //this should show a form that lets a user open a file
            $("#OpenLocalFile").css("visibility", "visible");
            $(".Spectacles_blackout").show();


            $(document).keyup(function (e) {
                //if the escape key  is pressed
                if (e.keyCode == 27) {
                    $("#OpenLocalFile").css("visibility", "hidden");
                    $(".Spectacles_blackout").hide();
                }
            });

        };

        //SCENE VARIABLES

        //background color
        this.backgroundColor = SPECT.backgroundColor;

        //ambient light color
        this.ambientLightColor = '#666666';

        //fog
        this.fog = true;

        this.view = "v";

        this.layers = "layers";

        //VIEW AND SELECTION VARIABLES

        //zoom extents
        this.zoomExtents = function () {
            SPECT.zoomExtents();
        };

        //zoom selected
        this.zoomSelected = function () {
            SPECT.zoomSelected();
        };




        //selected object color
        this.selectedObjectColor = "#FFFF00";

        //show stats?
        this.showStats = false;


        //LIGHTING VARIABLES

        //point lights color
        this.pointLightsColor = '#666666';

        //sun light on / off
        this.shadows = false;

        //sun azimuth and altitude
        this.solarAzimuth = 180;
        this.solarAltitude = 45;

    };

    //an object to store the live application variables and functions controlled by the UI
    //this is instantiated in the APP_INIT document.ready function
    SPECT.uiVariables = {};

    //this is the actual dat.gui object.  We'll add folders and UI objects in the APP_INIT document.ready function
    SPECT.datGui = {};

    //an object to hold all of our GUI folders, which will be keyed by name.  We need these from other places in the app
    //now that we are dynamically adding and subtracting UI elements.
    SPECT.UIfolders = {};




    //*********************
    //*********************
    //*** Element Selection and attribute (user data) display.

    //attributes object.  Contains logic for element selection and attribute list population
    SPECT.attributes = {};

    //top level property to track whether or not element attributes have been enabled
    SPECT.attributesEnabled = false;

    //element list.  This gets populated after a json file is loaded, and is used to check for intersections
    SPECT.attributes.elementList = [];

    //attributes list div - the div that we populate with attributes when an item is selected
    SPECT.attributes.attributeListDiv = {};

    //initialize attribtes function.  Call this once when initializing Spectacles to set up all of the
    //event handlers and application logic.
    SPECT.attributes.init = function () {

        //attribute properties used throughout attribute / selection code

        //set the state of this guy to true
        SPECT.attributesEnabled = true;

        //the three projector object used for turning a mouse click into a selection
        SPECT.attributes.projector = new THREE.Projector();

        //a material used to represent a clicked object
        SPECT.attributes.clickedMaterial = new THREE.MeshLambertMaterial({
            color: "rgb(255,255,0)",
            ambient: "rgb(255,255,0)",
            side: 2
        });

        //an object used to store the state of a selected element.
        SPECT.attributes.previousClickedElement = new SPECT.attributes.SelectedElement();

        //Append a div to the parent for us to populate with attributes.  handle any jquery.ui initialization here too
        SPECT.viewerDiv.append("<div class='Spectacles_attributeList'></div>");
        //function to position and size the blackout div
        var setAttributeList = function () {
            //set the position of the UI relative to the viewer div
            var targetDiv = $('.Spectacles_attributeList');

            //get upper left coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = SPECT.viewerDiv.offset().left - win.scrollLeft();
            var y = SPECT.viewerDiv.offset().top - win.scrollTop();

            //set the position and size
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', y.toString() + "px");
        };
        //call this the first time through
        setAttributeList();

        //respond to resize of Parent div
        SPECT.viewerDiv.resize(function () {
            setAttributeList();
        });

        //set our local variable to the div we just created
        SPECT.attributes.attributeListDiv = $('.Spectacles_attributeList');
        //make the attributes div draggable and resizeable
        SPECT.attributes.attributeListDiv.draggable({ containment: "parent" });

        //set up mouse event
        SPECT.viewerDiv.click(SPECT.attributes.onMouseClick);
    };

    //Constructor that creates an object to represent a selected element.
    //Used to store state of a previously selected element
    SPECT.attributes.SelectedElement = function () {
        this.materials = [];    //array of materials.  Holds one mat for each Mesh that the selected object contains
        this.id = -1;           //the ID of the element.  We use this to test whether something was already selected on a click
        this.object = {};       //the actual object that was selected.  This has been painted with our 'selected' material
        //and needs to be painted back with the materials in the materials array
    };

    //Mouse Click event handler for selection.  When a user clicks on the viewer, this gets called
    SPECT.attributes.onMouseClick = function (event) {

        //prevent the default event from triggering ... BH question - what is that event?  Test me.
        event.preventDefault();

        //call our checkIfSelected function
        SPECT.attributes.checkIfSelected(event);
    };

    //Function that checks whether the click should select an element, de-select an element, or do nothing.
    //This is called on a mouse click from the handler function directly above
    SPECT.attributes.checkIfSelected = function (event) {

        //get the canvas where three.js is running - it will be one of the children of our parent div
        var children = SPECT.viewerDiv.children();
        var canvas = {};
        for (var i = 0; i < children.length; i++) {
            if (children[i].tagName === "CANVAS") {
                //once we've found the element, wrap it in a jQuery object so we can call .position() and such.
                canvas = jQuery(children[i]);
                break;
            }
        }

        //get X and Y offset values for our div.  We do this every time in case the viewer is moving around
        var win = $(window);
        var offsetX = canvas.offset().left - win.scrollLeft();
        var offsetY = canvas.offset().top - win.scrollTop();


        //get a vector representing the mouse position in 3D
        //NEW - from here: https://stackoverflow.com/questions/11036106/three-js-projector-and-ray-objects/23492823#23492823
        var mouse3D = new THREE.Vector3(((event.clientX - offsetX) / canvas.width()) * 2 - 1, -((event.clientY - offsetY) / canvas.height()) * 2 + 1, 0.5);    //OFFSET THE MOUSE CURSOR BY -7PX!!!!
        mouse3D.unproject(SPECT.camera);
        mouse3D.sub(SPECT.camera.position);
        mouse3D.normalize();

        //Get a list of objects that intersect with the selection vector.  We'll take the first one (the closest)
        //the Spectacles element list is populated in the Spectacles.jsonLoader.processSceneGeometry function
        //which is called every time a scene is loaded
        var raycaster = new THREE.Raycaster(SPECT.camera.position, mouse3D);
        var intersects = raycaster.intersectObjects(SPECT.attributes.elementList);

        //are there any intersections?
        if (intersects.length > 0) {

            //get the closest intesected object
            var myIntersect;
            var i = 0;

            while (i < intersects.length) {
                myIntersect = intersects[i].object;
                i++;
                //get the first object that is visible
                if (myIntersect.visible == true) break;
            }

            // was this element hidden by clicking on its layer checkbox?
            if (myIntersect.visible == true) {
                //was this element already selected?  if so, do nothing.
                if (myIntersect.id === SPECT.attributes.previousClickedElement.id) return;

                //was another element already selected?
                if (SPECT.attributes.previousClickedElement.id !== -1) {
                    //restore previously selected object's state
                    SPECT.attributes.restorePreviouslySelectedObject();
                }


                //var to track whether the intersect is an object3d or a mesh
                var isObject3D = false;

                //did we intersect a mesh that belongs to an Object3D or a Geometry?  The former comes from Revit, the latter from GH
                if (myIntersect.parent.type === "Object3D") {
                    isObject3D = true;
                }


                //store the selected object
                SPECT.attributes.storeSelectedObject(myIntersect, isObject3D);

                //paint the selected object[s] with the application's 'selected' material
                if (isObject3D) {
                    //loop over the children and paint each one
                    for (var i = 0; i < myIntersect.parent.children.length; i++) {
                        SPECT.attributes.paintElement(myIntersect.parent.children[i], SPECT.attributes.clickedMaterial);
                    }
                }

                else {
                    //paint the mesh with the clicked material
                    SPECT.attributes.paintElement(myIntersect, SPECT.attributes.clickedMaterial);
                }


                //populate the attribute list with the object's user data
                if (isObject3D) {
                    SPECT.attributes.populateAttributeList(myIntersect.parent.userData);
                }
                else {
                    SPECT.attributes.populateAttributeList(myIntersect.userData);
                }
            }

            else {
                //if an item was already selected
                if (SPECT.attributes.previousClickedElement.id !== -1) {
                    //restore the previously selected object
                    SPECT.attributes.restorePreviouslySelectedObject();

                    //hide the attributes
                    SPECT.attributes.attributeListDiv.hide("slow");
                }
            }
        }

            //no selection.  Repaint previously selected item if required
        else {

            //if an item was already selected
            if (SPECT.attributes.previousClickedElement.id !== -1) {
                //restore the previously selected object
                SPECT.attributes.restorePreviouslySelectedObject();

                //hide the attributes
                SPECT.attributes.attributeListDiv.hide("slow");
            }
        }
    };

    //Function to restore the state of a previously selected object.
    SPECT.attributes.restorePreviouslySelectedObject = function () {

        //if nothing was selected, return
        if (SPECT.attributes.previousClickedElement.id === -1) return;

        //apply the stored materials to the meshes in the object.

        //are we working with an object3d?  if so we need to reset all of the children materials
        if (SPECT.attributes.previousClickedElement.object.type === "Object3D") {

            //loop over the children and repaint each one
            for (var i = 0; i < SPECT.attributes.previousClickedElement.materials.length; i++) {
                SPECT.attributes.paintElement(
                    SPECT.attributes.previousClickedElement.object.children[i],
                    SPECT.attributes.previousClickedElement.materials[i]
                );
            }


        }
        else { // we have a mesh

            //paint the mesh with it's original material
            SPECT.attributes.paintElement(
                SPECT.attributes.previousClickedElement.object,
                SPECT.attributes.previousClickedElement.materials[0]
            );
        }


        //set id to -1 and clear the other vars so they can be populated during hte next selection
        SPECT.attributes.previousClickedElement.id = -1;
        SPECT.attributes.previousClickedElement.materials = [];
        SPECT.attributes.previousClickedElement.object = {};

    };

    //Function to store a selected object in our attributes.PreviouslySelectedObject property.  Essentially a property setter
    //selected arg is the selected object
    //isObject3D arg is a bool describing whether  the selected object is of typeObject3D.  If so, we need to store it's children
    SPECT.attributes.storeSelectedObject = function (selected, isObject3D) {

        if (isObject3D) {
            //store the ID of the parent object.
            SPECT.attributes.previousClickedElement.id = selected.parent.id;

            //store the material of each child
            for (var i = 0; i < selected.parent.children.length; i++) {
                SPECT.attributes.previousClickedElement.materials.push(selected.parent.children[i].material);
            }

            //store the entire parent object
            SPECT.attributes.previousClickedElement.object = selected.parent;
        }
        else {
            //store the ID of the parent object.
            SPECT.attributes.previousClickedElement.id = selected.id;

            //store the material of the selection
            SPECT.attributes.previousClickedElement.materials.push(selected.material);

            //store the entire object
            SPECT.attributes.previousClickedElement.object = selected;
        }

    };

    //function to paint an element with a material.  Called when an element is selected or de-selected
    SPECT.attributes.paintElement = function (elementToPaint, material) {

        elementToPaint.material = material;

    };

    //function to populate the attribute list ( the user-facing html element ) with the selected element's attributes
    SPECT.attributes.populateAttributeList = function (jsonData) {

        //empty the contents of the html element
        SPECT.attributes.attributeListDiv.empty();

        //create a header
        SPECT.attributes.attributeListDiv.append('<div class="Spectacles_attributeListHeader">Element Attributes</div>');

        //add an empty item for some breathing room
        SPECT.attributes.attributeListDiv.append('<div class="item">-------</div>');

        //loop through json object attributes and create a new line for each property
        var rowCounter = 1;
        var longestString = 0;
        for (var key in jsonData) {
            if (jsonData.hasOwnProperty(key)) {

                //add the key value pair
                if (jsonData[key].substr(0, 4) !== 'http') {
                    SPECT.attributes.attributeListDiv.append('<div class="item">' + key + "  :  " + jsonData[key] + '</div>');
                } else {
                    var link = '<a href=' + jsonData[key] + ' target=_blank>' + jsonData[key] + '</a>';
                    SPECT.attributes.attributeListDiv.append('<div class="item">' + key + "  :  " + link + '</div>');
                }

                //compute the length of the key value pair
                var len = (key + "  :  " + jsonData[key]).length;
                if (len > longestString) longestString = len;
            }

            //increment the counter
            rowCounter++;
        }

        //change height based on # rows
        SPECT.attributes.attributeListDiv.height(rowCounter * 12 + 43);

        //set the width
        if (longestString > 50) {
            SPECT.attributes.attributeListDiv.width(longestString * 5 + 43);
        }
        else {
            SPECT.attributes.attributeListDiv.width(360);
        }

        //Show the html element
        SPECT.attributes.attributeListDiv.show("slow");
    };

    //function to handle changing the color of a selected element
    SPECT.attributes.setSelectedObjectColor = function (col) {
        SPECT.attributes.clickedMaterial.color = new THREE.Color(col);
        SPECT.attributes.clickedMaterial.ambient = new THREE.Color(col);
    };

    //function to purge local variables within this object.  When a user loads a new scene, we have to clear out the old stuff
    SPECT.attributes.purge = function () {
        if (SPECT.attributesEnabled) {
            this.restorePreviouslySelectedObject();
        }
        this.elementList = [];
    };

    //function to zoom to the selected object
    SPECT.zoomSelected = function(){

        //return if init has not been called
        if ( SPECT.attributes.previousClickedElement === undefined) return;

        //return if no selection
        if (SPECT.attributes.previousClickedElement.id === -1) return;

        //get selected item and it's bounding sphere
        var bndSphere;
        var sel = SPECT.attributes.previousClickedElement.object;

        //if the object is a mesh, grab the sphere
        if (sel.hasOwnProperty('geometry')) {
            //sel.computeBoundingSphere();
            bndSphere = sel.geometry.boundingSphere;
        }

        //if the object is object3d, merge all of it's geometries and compute the sphere of the merge
        else {
            var geo = new THREE.Geometry();
            for (var i in sel.children) {
                geo.merge(sel.children[i].geometry);
            }
            geo.computeBoundingSphere();
            bndSphere = geo.boundingSphere;
        }


        //get the radius of the sphere and use it to compute an offset.  This is a mashup of theo's method and ours from platypus
        var r = bndSphere.radius;
        var offset = r / Math.tan(Math.PI / 180.0 * SPECT.orbitControls.object.fov * 0.5);
        var vector = new THREE.Vector3(0, 0, 1);
        var dir = vector.applyQuaternion(SPECT.orbitControls.object.quaternion);
        var newPos = new THREE.Vector3();
        dir.multiplyScalar(offset * 1.1);
        newPos.addVectors(bndSphere.center, dir);
        SPECT.orbitControls.object.position.set(newPos.x, newPos.y, newPos.z);
        SPECT.orbitControls.target = new THREE.Vector3(bndSphere.center.x, bndSphere.center.y, bndSphere.center.z);

    };



    //*********************
    //*********************
    //*** Views - camera positions can be stored in the .json file, and we provide UI to switch between views.
    SPECT.views = {};

    //the active array of views
    SPECT.views.viewList = [];

    //a bool to track whether or not views have been enabled by the user
    SPECT.viewsEnabled = false;

    //function to get views from the active scene and populate our list of views
    SPECT.views.getViews = function () {
        try {
            if (SPECT.scene.userData.views.length > 0) {
                //create a default view

                SPECT.views.defaultView.name = "DefaultView";
                SPECT.views.viewList.push(SPECT.views.defaultView);

                //add the views in the json file
                //if the project was exported from Revit, there is only one view
                if (SPECT.scene.name.indexOf("BIM") != -1) {

                    var v = SPECT.scene.userData.views.split(",");
                    for (var k = 0; k < v.length; k+=7) {
                        var revitView = {}
                        revitView.name = v[k];
                        revitView.eye = {};
                        revitView.eye.X = parseFloat(v[k + 1]);
                        revitView.eye.Y = parseFloat(v[k + 2]);
                        revitView.eye.Z = parseFloat(v[k + 3]);
                        revitView.target = {};
                        revitView.target.X = parseFloat(v[k + 4]);
                        revitView.target.Y = parseFloat(v[k + 5]);
                        revitView.target.Z = parseFloat(v[k + 6]);
                        SPECT.views.viewList.push(revitView);
                    }
                }

                    //for Grasshopper files
                else {

                    for (var k = 0, kLen = SPECT.scene.userData.views.length; k < kLen; k++) {
                        var itemView = SPECT.scene.userData.views[k];
                        SPECT.views.viewList.push(itemView);
                    }
                }
            }
        }
        catch (err) { }
    };

    //funciton to create the user interface for view selection
    SPECT.views.CreateViewUI = function () {

        //if there are saved views, get their names and create a dat.GUI controller
        if (SPECT.views.viewList.length > 0) {

            //get an array of all of the view names
            viewStrings = [];
            for (var i = 0; i < SPECT.views.viewList.length; i++) {
                viewStrings.push(SPECT.views.viewList[i].name);
            }
            viewStrings.sort();

            //set the first view to be the current view
            this.setView('DefaultView');

            //make sure the view and selection folder exists - if it doesn't, throw an error
            if (SPECT.UIfolders.View_and_Selection === undefined) throw "View and selection folder must be initialized";

            //add the view dropdown, and call our reset view function on a change
            SPECT.UIfolders.View_and_Selection.add(SPECT.uiVariables, 'view', viewStrings).onFinishChange(function (e) {
                SPECT.views.resetView();
            });
        }
    };

    //function to set the current view
    SPECT.views.setView = function (v) {
        if (this.viewList.length > 0) {
            SPECT.uiVariables.view = v;
        }
    };

    //function to reset the view ... not sure why we need both - AGP?
    SPECT.views.resetView = function () {
        var vector = new THREE.Vector3(0, 0, 1);
        var up = vector.applyQuaternion(SPECT.orbitControls.object.quaternion);

        //get the current camera by name
        var view;
        for (var i = 0; i < this.viewList.length; i++) {
            var v = this.viewList[i];
            if (v.name === SPECT.uiVariables.view) {
                view = v;
                break;
            }
        }

        //if we found a view, activate it
        if (view) {
            //get the eyePos from the current view
            var eyePos = new THREE.Vector3(view.eye.X, view.eye.Y, view.eye.Z);

            //get the targetPos from the current view
            //var dir = new THREE.Vector3(-view.target.X, view.target.Z, view.target.Y);

            var dir = new THREE.Vector3(view.target.X, view.target.Y, view.target.Z);


            SPECT.orbitControls.target.set(dir.x, dir.y, dir.z);
            SPECT.orbitControls.object.position.set(eyePos.x, eyePos.y, eyePos.z);

        }
    };

    //function to purge the list of views
    SPECT.views.purge = function () {
        //reset the list
        if (this.viewList.length > 0) this.viewList = [];

        try { //purge view controller
            var viewFolder = SPECT.datGui.__folders.View_and_Selection;

            for (var i = 0; i < viewFolder.__controllers.length; i++) {
                if (viewFolder.__controllers[i].property == "view") {
                    viewFolder.__controllers[i].remove();
                    break;
                }
            }
        } catch (e) {
        }
    };
    SPECT.views.defaultView = {};

    SPECT.views.storeDefaultView = function () {
        SPECT.views.defaultView.eye = {};
        SPECT.views.defaultView.target = {};
        SPECT.views.defaultView.eye.X = SPECT.orbitControls.object.position.x;
        SPECT.views.defaultView.eye.Y = SPECT.orbitControls.object.position.y;
        SPECT.views.defaultView.eye.Z = SPECT.orbitControls.object.position.z;
        SPECT.views.defaultView.target.X = SPECT.orbitControls.target.x;
        SPECT.views.defaultView.target.Y = SPECT.orbitControls.target.y;
        SPECT.views.defaultView.target.Z = SPECT.orbitControls.target.z;

    };



    //*********************
    //*********************
    //*** Layers - [exported] objects can contain a user data attribute called 'layer' which we use to provide a layers interface.
    SPECT.layers = {};

    //the active array of layers
    SPECT.layers.layerList = [];

    //a bool to track whether or not layers have been enabled by the user
    SPECT.layersEnabled = false;

    //function to get layers from the active scene and populate our list
    SPECT.layers.getLayers = function () {
        try {
            if (SPECT.scene.userData.layers.length > 0) {
                //if the project was exported from Revit
                if (SPECT.scene.name.indexOf("BIM") != -1) {

                    var lay = SPECT.scene.userData.layers.split(',');
                    SPECT.layers.layerList = lay;

                }
                    //for Grasshopper files
                else {
                    for (var k = 0, kLen = SPECT.scene.userData.layers.length; k < kLen; k++) {
                        var itemLayer = SPECT.scene.userData.layers[k];
                        SPECT.layers.layerList.push(itemLayer);
                    }
                }
            }
        }
        catch (err) { }
    };

    //function to create the user interface for view selection
    SPECT.layers.CreateLayerUI = function () {
        //if there are saved layers, create a checkbox for each of them
        if (SPECT.layers.layerList.length > 0) {
            layerStrings = [];
            for (var i = 0; i < SPECT.layers.layerList.length; i++) {
                //for Grasshopper files, this will return the name of the layer
                var lName = SPECT.layers.layerList[i].name;
                // for Revit files, this will be undefined. We need to grab the object itself
                if (lName == null) {
                    lName = SPECT.layers.layerList[i];
                }
                if (lName != "Cameras") layerStrings.push(lName);
            }
            //sort layers by name
            layerStrings.sort();
            try {
                var layerFolder = SPECT.datGui.addFolder('Layers');
            }
            catch (err) {
                //the layer folder already exists
                var layerFolder = SPECT.datGui.__folders.Layers;
            }
            for (var i = 0; i < layerStrings.length; i++) {

                //create an layer object that has a boolean property with its name
                var layer = {};
                layer[layerStrings[i]] = true;

                //add a checkbox per layer
                layerFolder.add(layer, layerStrings[i]).onChange(function (e) {

                    // get the name of the controller that fired the event -- there must be a different way of doing this...
                    var layerName = this.domElement.parentElement.firstChild.innerHTML;
                    for (var i = 0; i < SPECT.attributes.elementList.length; i++) {
                        var element = SPECT.attributes.elementList[i];

                        var changeVisibility = false;
                        // if it is a project created in Revit, we need to get the parent of the element, the 3D object to get the user data recorded
                        if (SPECT.scene.name.indexOf("BIM") != -1) {
                            var parent = element.parent;
                            if (parent.userData.layer == layerName) changeVisibility = true;
                        }
                            //for GH objects
                        else {
                            if (element.userData.layer == layerName) changeVisibility = true;
                        }
                        if (changeVisibility) {
                            //if unchecked, make it invisible
                            if (element.visible == true) element.visible = false;
                                //otherwise, show it
                            else element.visible = true;
                        }
                    }

                });
            }
        }
    };

    //function to purge the list of layers
    SPECT.layers.purge = function () {
        //reset our list
        if (this.layerList.length > 0) this.layerList = [];

        //purge layer folder
        try {
            var layerFolder = SPECT.datGui.__folders.Layers;
            var layerCount = layerFolder.__controllers.length;
            for (var i = 0; i < layerCount; i++) {
                layerFolder.__controllers[0].remove();
            }

            //remove the Layers folder -- this is not working
            SPECT.datGui.removeFolder('Layers');

        }

        catch (err) { }
    };





    //now all functions have been initialized.  Call init viewer to start the application
    SPECT.initViewer(SPECT.viewerDiv);

    //if the user passed in a json file, load it.
    if (jsonFileData !== undefined) {
        SPECT.jsonLoader.loadSceneFromJson(jsonFileData);
        SPECT.zoomExtents();
        SPECT.views.storeDefaultView();
    }

    //if the user supplied a callback function, call it and pass our application object (this)
    if (callback !== undefined) {
        try {
            callback(SPECT);
        } catch (e) {
        }
    }

};
