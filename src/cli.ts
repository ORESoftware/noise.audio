#!/usr/bin/env node
'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as assert from 'assert';
import * as EE from 'events';
import * as strm from "stream";

import * as Tone from "tone";
// @ts-ignore
import * as WavEncoder from "wav-encoder";
import { writeFileSync } from "fs";

async function generateNoiseAudio() {
  const sampleRate = 44100; // Standard audio sample rate
  const duration = 6 * 60; // 6 minutes in seconds
  const noiseTypes = ["brown", "white", "pink", "gray"] as const;
  let currentNoise: typeof noiseTypes[number] = "white";

  const transitionDuration = 2; // Transition duration in seconds
  let remainingTime = duration;

  // Initialize an audio buffer
  const audioBuffer = new Float32Array(sampleRate * duration);

  // Helper: Generate noise
  function generateNoise(type: typeof noiseTypes[number], length: number) {
    const buffer = new Float32Array(length);
    const random = Math.random;
    let lastBrown = 0;

    for (let i = 0; i < length; i++) {
      switch (type) {
        case "white":
          buffer[i] = random() * 2 - 1;
          break;
        case "pink":
          buffer[i] = (random() + random() - 1) * 0.5;
          break;
        case "brown":
          lastBrown += random() * 2 - 1;
          buffer[i] = lastBrown * 0.02; // Scale to prevent overflow
          lastBrown *= 0.98; // Damping factor
          break;
        case "gray":
          buffer[i] = (random() * 2 - 1) * 0.8; // Slightly softer white noise
          break;
      }
    }

    return buffer;
  }

  // Helper: Blend between two buffers
  function blendBuffers(buffer1: Float32Array, buffer2: Float32Array, blendFactor: number) {
    const length = buffer1.length;
    const result = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      result[i] = buffer1[i] * (1 - blendFactor) + buffer2[i] * blendFactor;
    }

    return result;
  }

  let writeIndex = 0;

  while (remainingTime > 0) {
    // Decide how long to play this noise
    const noiseSegmentDuration = Math.min(
      remainingTime,
      Math.random() * 4 + 3 // Random between 3-7 seconds
    );
    const segmentSamples = Math.floor(noiseSegmentDuration * sampleRate);

    // Choose the next noise type and generate buffers
    const nextNoise = noiseTypes[Math.floor(Math.random() * noiseTypes.length)];
    const currentBuffer = generateNoise(currentNoise, segmentSamples);
    const nextBuffer = generateNoise(nextNoise, Math.floor(transitionDuration * sampleRate));

    // Blend for a smooth transition
    for (let t = 0; t < transitionDuration * sampleRate; t++) {
      const blendFactor = t / (transitionDuration * sampleRate);
      const blendedSample = blendBuffers(
        currentBuffer.slice(t, t + 1),
        nextBuffer.slice(t, t + 1),
        blendFactor
      );
      audioBuffer[writeIndex++] = blendedSample[0];
    }

    // Add the current buffer to the main audio buffer
    audioBuffer.set(currentBuffer.slice(0, segmentSamples), writeIndex);
    writeIndex += segmentSamples;

    currentNoise = nextNoise;
    remainingTime -= noiseSegmentDuration + transitionDuration;
  }

  // Encode and save the audio
  const wavData = await WavEncoder.encode({
    sampleRate,
    channelData: [audioBuffer]
  });

  writeFileSync("output.wav", Buffer.from(wavData));
  console.log("Audio file saved as output.wav");
}

generateNoiseAudio().catch(console.error);
