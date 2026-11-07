/* Capture off the UI thread. sherpa-onnx resamples the actual device rate. */
class RecoveryCapture extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Float32Array(1024);this.offset=0;}
 process(inputs){
  const input=inputs[0]?.[0];if(!input)return true;
  for(let i=0;i<input.length;i++){
   this.buffer[this.offset++]=input[i];
   if(this.offset===this.buffer.length){this.port.postMessage({samples:this.buffer,rate:sampleRate},[this.buffer.buffer]);this.buffer=new Float32Array(1024);this.offset=0;}
  }
  return true;
 }
}
registerProcessor('recovery-capture',RecoveryCapture);
