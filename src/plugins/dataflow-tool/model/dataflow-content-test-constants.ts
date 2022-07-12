
export const newDataRate = 10;
export const newZoom = { dx: 1, dy: 1, scale: 10 };

// program has four nodes: Generator, Timer, Logic, Light Bulb
export const exampleProgram = [
  '{"id":"dataflow@0.1.0","nodes":{"1":{"id":1,"data":',
  '{"recentValues":[0.85,0.88,0.91,0.94,0.96,0.97,0.99,',
  '0.99,1,1,1,0.99,0.98,0.96,0.95,0.92,0.9],"plot":true,',
  '"nodeValue":0.9,"generatorType":"Sine","amplitudeUnits"',
  ':"","amplitude":1,"periodUnits":"sec","period":10,',
  '"inputKeys":[]},"inputs":{},"outputs":{"num":{"connections"',
  ':[{"node":14,"input":"num1","data":{}}]}},"position":',
  '[40,4.875],"name":"Generator"},"5":{"id":5,"data":{',
  '"recentValues":[0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],"plot":',
  'false,"nodeValue":1,"timeOnUnits":"sec","timeOn":1,',
  '"timeOffUnits":"sec","timeOff":1.5,"inputKeys":[]},"inputs":',
  '{},"outputs":{"num":{"connections":[{"node":14,"input":"num2",',
  '"data":{}}]}},"position":[43.87890625,288.71875],"name":"Timer"}',
  ',"14":{"id":14,"data":{"recentValues":[1,1,1,1,1,1,1,1,1,1,0,0,0',
  ',0,0,0,0],"plot":false,"nodeValue":0,"logicOperator":"Greater Than"',
  ',"inputKeys":[]},"inputs":{"num1":{"connections":[{"node":1,"output"',
  ':"num","data":{}}]},"num2":{"connections":[{"node":5,"output":"num"',
  ',"data":{}}]}},"outputs":{"num":{"connections":[{"node":21,"input":',
  '"num1","data":{}}]}},"position":[257.80690259442116,48.81143746722975]',
  ',"name":"Logic"},"21":{"id":21,"data":{"recentValues":[1,1,1,1,1,1,1,1,',
  '1,1,0,0,0,0,0,0,0],"plot":false,"nodeValue":0,"lightbulb":0,"inputKeys":',
  '[]},"inputs":{"num1":{"connections":[{"node":14,"output":"num","data":{}}]',
  '}},"outputs":{},"position":[335.2006292971992,209.26591278086048],"name":"Light Bulb"}}}'
].join('');
