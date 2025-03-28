#!/usr/bin/env node
'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as assert from 'assert';
import * as EE from 'events';
import * as strm from "stream";

// @ts-ignore
import * as WavEncoder from "wav-encoder";
import { writeFileSync } from "fs";

async function generateNoiseAudio() {
  const sampleRate = 44100; // Standard audio sample rate
  const duration = 6 * 60; // 6 minutes in seconds
  const noiseTypes = ["brown", "white", "pink", "gray"] as const;
  let currentNoise: typeof noiseTypes[number] = "white";

  const transitionDuration = 1; // Transition duration in seconds
  const transitionSamples = Math.floor(transitionDuration * sampleRate); // Number of samples for transitions
  let remainingTime = duration;

  // Initialize an audio buffer for the base layer
  const baseAudioBuffer = new Float32Array(sampleRate * duration);
  let writeIndex = 0;

  // Helper: Generate noise
  function generateNoise(type: typeof noiseTypes[number], length: number, volume: number = 1) {
    const buffer = new Float32Array(length);
    const random = Math.random;
    let lastBrown = 0;

    for (let i = 0; i < length; i++) {
      switch (type) {
        case "white":
          buffer[i] = (random() * 2 - 1) * volume * 0.8;
          break;
        case "pink":
          buffer[i] = ((random() + random() - 1) * 0.5) * volume * 0.7;
          break;
        case "brown":
          lastBrown += random() * 2 - 1;
          buffer[i] = (lastBrown * 0.02 * volume) * 1.2;
          lastBrown *= 0.98;
          break;
        case "gray":
          buffer[i] = ((random() * 2 - 1) * volume) * 0.6;
          break;
      }
    }

    return buffer;
  }

  // Helper: Blend two buffers linearly
  function blendBuffers(buffer1: Float32Array, buffer2: Float32Array) {
    const length = Math.min(buffer1.length, buffer2.length);
    const result = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const blendFactor = i / length;
      result[i] = buffer1[i] * (1 - blendFactor) + buffer2[i] * blendFactor;
    }

    return result;
  }

  while (remainingTime > 0 && writeIndex < baseAudioBuffer.length) {
    const noiseSegmentDuration = Math.min(
      remainingTime,
      Math.random() * 4 + 3 // Random between 3-7 seconds
    );
    const segmentSamples = Math.floor(noiseSegmentDuration * sampleRate);
    const safeSegmentSamples = Math.min(segmentSamples, baseAudioBuffer.length - writeIndex);

    const currentBuffer = generateNoise(currentNoise, safeSegmentSamples, 1);
    const nextNoise = noiseTypes[Math.floor(Math.random() * noiseTypes.length)];
    const nextBuffer = generateNoise(nextNoise, transitionSamples, 1);

    const transitionOutBuffer = blendBuffers(
      currentBuffer.slice(-transitionSamples),
      nextBuffer
    );

    for (let i = 0; i < transitionSamples && writeIndex < baseAudioBuffer.length; i++) {
      baseAudioBuffer[writeIndex++] = transitionOutBuffer[i];
    }

    for (let i = 0; i < safeSegmentSamples - transitionSamples && writeIndex < baseAudioBuffer.length; i++) {
      baseAudioBuffer[writeIndex++] = currentBuffer[i];
    }

    for (let i = 0; i < transitionSamples && writeIndex < baseAudioBuffer.length; i++) {
      baseAudioBuffer[writeIndex++] = nextBuffer[i];
    }

    currentNoise = nextNoise;
    remainingTime -= noiseSegmentDuration + transitionDuration;
  }

  // Overlay 5 layers with staggered start times
  const layeredAudioBuffer = new Float32Array(baseAudioBuffer.length);

  for (let layer = 0; layer < 5; layer++) {
    const layerStartOffset = Math.floor(Math.random() * sampleRate); // Random offset < 1 second
    const layerBuffer = new Float32Array(baseAudioBuffer.length);

    for (let i = 0; i < baseAudioBuffer.length - layerStartOffset; i++) {
      layerBuffer[i + layerStartOffset] = baseAudioBuffer[i];
    }

    // Combine layer into the main layered buffer
    for (let i = 0; i < layeredAudioBuffer.length; i++) {
      layeredAudioBuffer[i] += layerBuffer[i] / 5; // Normalize by dividing by 5
    }
  }

  // Encode and save the layered audio
  const wavData = await WavEncoder.encode({
    sampleRate,
    channelData: [layeredAudioBuffer]
  });

  writeFileSync("output.wav", Buffer.from(wavData));
  console.log("Audio file saved as output.wav");
}

generateNoiseAudio().catch(console.error);
