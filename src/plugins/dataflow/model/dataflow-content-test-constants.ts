
export const newDataRate = 10;
export const newZoom = { x: 1, y: 1, k: 10 };

// program has four nodes: Generator, Timer, Number, Demo Output
export const exampleProgram = `{
  "id": "dataflow@0.1.0",
  "nodes": {
      "114": {
          "id": 114,
          "data": {
              "plot": false,
              "generatorType": "Sine",
              "amplitudeUnits": "",
              "amplitude": 1,
              "periodUnits": "sec",
              "period": 10,
              "inputKeys": [],
              "recentValues": {
                  "nodeValue": [
                      -0.01,
                      -0.04,
                      -0.07,
                      -0.1,
                      -0.13,
                      -0.16,
                      -0.19,
                      -0.22,
                      -0.25,
                      -0.28,
                      -0.31,
                      -0.34,
                      -0.37,
                      -0.4,
                      -0.43,
                      -0.46,
                      -0.49
                  ]
              },
              "nodeValue": -0.49,
              "watchedValues": {
                  "nodeValue": {
                      "backgroundColor": "#969696",
                      "borderColor": "#969696"
                  }
              }
          },
          "inputs": {},
          "outputs": {
              "num": {
                  "connections": [
                      {
                          "node": 135,
                          "input": "speed",
                          "data": {}
                      }
                  ]
              }
          },
          "position": [
              40,
              179.95808707758704
          ],
          "name": "Generator"
      },
      "121": {
          "id": 121,
          "data": {
              "plot": false,
              "timeOnUnits": "sec",
              "timeOn": 5,
              "timeOffUnits": "sec",
              "timeOff": 5,
              "inputKeys": [],
              "recentValues": {
                  "nodeValue": [
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0
                  ]
              },
              "nodeValue": 0,
              "watchedValues": {
                  "nodeValue": {
                      "backgroundColor": "#969696",
                      "borderColor": "#969696"
                  }
              }
          },
          "inputs": {},
          "outputs": {
              "num": {
                  "connections": [
                      {
                          "node": 135,
                          "input": "nodeValue",
                          "data": {}
                      }
                  ]
              }
          },
          "position": [
              48.323047258041456,
              8.54730932897857
          ],
          "name": "Timer"
      },
      "131": {
          "id": 131,
          "data": {
              "plot": false,
              "nodeValueUnits": "",
              "inputKeys": [],
              "recentValues": {
                  "nodeValue": [
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5
                  ]
              },
              "nodeValue": 0.5,
              "watchedValues": {
                  "nodeValue": {
                      "backgroundColor": "#969696",
                      "borderColor": "#969696"
                  }
              }
          },
          "inputs": {},
          "outputs": {
              "num": {
                  "connections": [
                      {
                          "node": 135,
                          "input": "tilt",
                          "data": {}
                      }
                  ]
              }
          },
          "position": [
              36.164463960492576,
              385.82698997907687
          ],
          "name": "Number"
      },
      "135": {
          "id": 135,
          "data": {
              "plot": true,
              "outputType": "Grabber",
              "demoOutput": 0,
              "inputKeys": [],
              "recentValues": {
                  "nodeValue": [
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0
                  ],
                  "speed": [
                      0.03,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0
                  ],
                  "tilt": [
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5,
                      0.5
                  ]
              },
              "nodeValue": 0,
              "speed": 0,
              "tilt": 0.5,
              "watchedValues": {
                  "nodeValue": {
                      "backgroundColor": "#969696",
                      "borderColor": "#969696"
                  },
                  "speed": {
                      "backgroundColor": "#3974ff",
                      "borderColor": "#3974ff"
                  },
                  "tilt": {
                      "backgroundColor": "#fff",
                      "borderColor": "#ff3d3d"
                  }
              }
          },
          "inputs": {
              "nodeValue": {
                  "connections": [
                      {
                          "node": 121,
                          "output": "num",
                          "data": {}
                      }
                  ]
              },
              "speed": {
                  "connections": [
                      {
                          "node": 114,
                          "output": "num",
                          "data": {}
                      }
                  ]
              },
              "tilt": {
                  "connections": [
                      {
                          "node": 131,
                          "output": "num",
                          "data": {}
                      }
                  ]
              }
          },
          "outputs": {},
          "position": [
              375.4836098985763,
              9.486459726975589
          ],
          "name": "Demo Output"
      }
  }
}`;
