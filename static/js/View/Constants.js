var constants = {
	map : {
		width : 1000,
		height : 600,
		background : "#323232",
		connections : {
			shadow : new Shadow("#000000", 0, 0, 2),
			stroke : {
				size : 2,
				color : "#FFFFFF"
			}
		},
		continents : {
			border : {
				size : 9,
				shadow : new Shadow("#000000", 0, 0, 5)
			},
			label : {
				font : "bold 20px Tahoma",
				shadow : new Shadow("#000000", 0, 0, 2)
			}
		},
		regions : {
			colors : [ "#C2C2C2" ],
			troops : {
				font : "bold 10px Arial",
				color : "#FFFFFF",
				circle : {
					stroke : {
						size : 2,
						color : Graphics.getRGB(255, 255, 255)
					},
					fill : Graphics.getRGB(0, 0, 0),
					radius : 12,
					shadow : new Shadow("#000000", 0, 0, 3)
				}
			},
			label : {
				font : "bold 12px Arial",
				color : "#FFFFFF",
				shadow : new Shadow("#000000", 1, 1, 2)
			},
			border : {
				size : 1,
				color : Graphics.getRGB(0, 0, 0, 1)
			},
			highlightBorder : {
				size : 4,
				color : Graphics.getRGB(255, 255, 255, 1)
			}
		},
		dragLine : {
			shadow : new Shadow("#000000", 0, 0, 2),
			stroke : {
				size : 3,
				color : "#ffffff"
			}
		}
	}
};