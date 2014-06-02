GS.GameStates = {
	PreLoad: 0,
	Loading: 1,
	PostLoad: 2,
	Play: 3,
	Menu: 4,
};

GS.Game = function() {
	GS.Base.call(this);

	this.state = GS.GameStates.PreLoad;
	this.nextState = null;
	this.updated = false;
	this.firstTime = true;
	
	this.antialias = false;
	this.clearColor = 0x336699;
	this.cameraFov = GS.Settings.fov;

	this.mapName = "airstrip1";
	this.useAssetsZip = false;

	if (GS.BuildOverride === true) {
		this.useAssetsZip = true;
	}
	
	this.debugMode = true;
	this.showFPS = true;
};

GS.Game.prototype = GS.inherit(GS.Base, {
	constructor: GS.Game,

	init: function() {
		GS.DebugUI.init();
		GS.DebugUI.visible = false;

		this.loadingUI = new GS.LoadingUI();
		this.loadingUI.init();

		this.uiManager = new GS.UIManager();
		this.uiManager.init();

		this.soundManager = new GS.SoundManager();
		this.soundManager.init();

		this.musicManager = new GS.MusicManager();
		this.musicManager.init();

		this.initAssetLoader();

		this.keys = {
			Escape: 27,
		};

		GS.Base.prototype.init.call(this);

		this.graphicsManager = new GS.GraphicsManager(this.renderer, this.camera);
		this.graphicsManager.init();
	},

	registerConsoleCommands: function() {
		var that = this;

		window.newGame = function() {
			if (that.uiManager.menuActive) {
				that.closeMenu();
			}

			that.mapName = "airstrip1"; 
			that.nextState = GS.GameStates.PreLoad; 
		};

		window.load = function(mapName) { 
			if (that.uiManager.menuActive) {
				that.closeMenu();
			}

			that.mapName = mapName; 
			that.nextState = GS.GameStates.PreLoad; 
		};

		window.fov = function(value) { 
			that.cameraFov = Math.floor(GS.MathHelper.clamp(value, 60, 120));
			GS.Settings.fov = that.cameraFov;
			that.updateFov();
		};

		window.__defineGetter__("debug", function() {
			that.debugMode = !that.debugMode; 
			GS.DebugUI.visible = that.debugMode; 
			return that.debugMode; 
		});
	},

	preLoad: function() {
		var that = this;

		this.dispose();
		this.registerConsoleCommands();
		this.uiManager.reset();
		
		this.loadingUI.percentLoaded = 0;
		this.loadingUI.show();

		this.lastLoadStartTime = new Date();

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.Fog(new THREE.Color().setRGB(0, 0, 0).getHex(), 500, 900);

		if (!this.assetLoader.loaded) {
			this.assetLoader.load();
			this.nextState = GS.GameStates.Loading;
		} else {
			this.nextState = GS.GameStates.PostLoad;
		}		
	},

	initAssetLoader: function() {
		var that = this;

		if (this.useAssetsZip) {
			this.assetLoader = new GS.ZipAssetLoader(this.soundManager.ctx);
		} else {
			this.assetLoader = new GS.AssetLoader(this.soundManager.ctx);
		}

		this.assetLoader.init();
		this.assetLoader.addEventListener("progress", function(e) {
			that.loadingUI.updateProgress(e);
		});
		this.assetLoader.addEventListener("load", function(e) {
			that.loadingUI.updateProgress(e);
			that.nextState = GS.GameStates.PostLoad;
		});
	},

	postLoad: function() {
		this.initComponents(this.assetLoader.assets);
		this.uiManager.initComponents(this.assetLoader.assets, this.grid);

		if (this.debugMode) {
			console.log("loading time: " + ((new Date() - this.lastLoadStartTime) / 1000).toFixed(2) + "s");
		}

		// GAME.grid.exportMapToOBJ();

		this.nextState = GS.GameStates.Play;

		this.musicManager.playTrack("simple_action_beat");

		if (this.firstTime) {
			this.openMenu();
			this.firstTime = false;
		}
	},

	play: function() {
		GS.InputHelper.checkPressedKeys();

		if (!GS.InputHelper.keysPressed && GS.InputHelper.isKeyDown(this.keys.Escape)) {
			this.openMenu();
		}

		this.grid.update();
		this.uiManager.update();

		TWEEN.update();
	},

	menu: function() {
		GS.InputHelper.checkPressedKeys();

		if (!GS.InputHelper.keysPressed && GS.InputHelper.isKeyDown(this.keys.Escape)) {
			this.closeMenu();
		}

		this.uiManager.update();
	},

	openMenu: function() {
		this.nextState = GS.GameStates.Menu;
		this.grid.player.inMenu = true;
		this.grid.player.controls.disable();
		this.grid.player.controls.detachEvents();
		this.graphicsManager.monochromeEnabled = true;
		this.uiManager.menuActive = true;

		if (this.debugMode) {
			GS.DebugUI.visible = false;
		}
	},

	closeMenu: function() {
		this.nextState = GS.GameStates.Play;
		this.grid.player.inMenu = false;		
		this.grid.player.controls.attachEvents();
		this.grid.player.controls.enable();
		this.graphicsManager.monochromeEnabled = false;
		this.uiManager.menuActive = false;
		
		if (this.debugMode) {
			GS.DebugUI.visible = true;
		}
	},

	initComponents: function(assets) {
		var that = this;
		var map = this.assetLoader.mapLoader.parse(assets[GS.AssetTypes.Map][this.mapName]);

		var viewFactory = new GS.ViewFactory(this.renderer, map, assets, this.tvStation);
		viewFactory.init();		
		var gridFactory = new GS.GridFactory(viewFactory, this.soundManager, this.renderer, this.scene, this.camera);
		this.grid = gridFactory.getGrid(map);

		this.soundManager.initSounds(assets[GS.AssetTypes.Sound]);
		this.musicManager.initTracks(assets[GS.AssetTypes.MusicTrack]);
		this.graphicsManager.setGrid(this.grid);
		
		this.grid.player.controls.addEventListener("pointerLockDisabled", function() { that.openMenu(); });

		if (this.debugMode) {
			console.log("collision triangles", viewFactory.triangleCount);
		}
	},

	update: function() {
		GS.DebugUI.update();

		if (this.state == GS.GameStates.PreLoad) {
			if (!this.updated) {
				this.updated = true;
				this.preLoad();
			}
		} else 
		if (this.state == GS.GameStates.Loading) {
			this.updated = true;
		} else
		if (this.state == GS.GameStates.PostLoad) {
			if (!this.updated) {
				this.updated = true;
				this.postLoad();
			}
		} else 
		if (this.state == GS.GameStates.Play) {
			this.updated = true;
			this.play();
		} else
		if (this.state == GS.GameStates.Menu) {
			this.updated = true;
			this.menu();
		}

		if (this.nextState != null) {
			if (this.updated) {
				if (this.nextState == GS.GameStates.Play || this.nextState == GS.GameStates.Menu) {
					this.loadingUI.hide();
					this.uiManager.show();
				}

				this.state = this.nextState;
				this.nextState = null;
				this.updated = false;
			}
		}
	},

	draw: function() {
		if (this.state == GS.GameStates.PreLoad) {
			this.loadingUI.draw();
		} else 
		if (this.state == GS.GameStates.Loading) {
			this.loadingUI.draw();
		} else
		if (this.state == GS.GameStates.PostLoad) {
			this.loadingUI.draw();
		} else 
		if (this.state == GS.GameStates.Play || this.state == GS.GameStates.Menu) {
			this.graphicsManager.draw();
			this.uiManager.draw();
		}
	},

	onResize: function() {
		GS.Base.prototype.onResize.call(this);

		this.uiManager.onResize();
		this.loadingUI.onResize();

		if (this.state == GS.GameStates.Play) {
			this.graphicsManager.onResize();
			this.grid.onResize();
			this.grid.player.playerView.onResize();
		}
	},

	updateFov: function() {
		this.camera.fov = GS.Settings.fov;
		this.camera.updateProjectionMatrix();

		if (this.state == GS.GameStates.Play) {
			this.grid.updateFov();
		}
	},

	dispose: function() {
		delete window.load;
		delete window.fov;
		delete window.debug;
		delete window.newGame;

		if (this.grid !== undefined) {
			this.grid.dispose();
		}
		this.grid = undefined;

		TWEEN.removeAll();

		this.graphicsManager.reset();

		this.scene = undefined;
		this.state = 4;
	},
});

var GAME;
window.addEventListener("load", function() {
	GAME = new GS.Game();
	GAME.init();
}, false);