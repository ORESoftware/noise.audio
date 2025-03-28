#!/usr/bin/env node
'use strict';

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as WavEncoder from "wav-encoder";

const sampleRate = 44100; // Standard audio sample rate
const duration = 6 * 60; // 6 minutes in seconds
const baseWavelength = 4; // Standard wavelength in seconds
const noiseTypes = ["gray", "pink", "red", "green"] as const;
const sineWavesCount = noiseTypes.length;

async function generateContinualSineWaves() {
  const totalSamples = sampleRate * duration;
  const sineWaves: Float32Array[] = [];
  const maxDeviation = 0.5; // Allow wavelength deviation by ±50%
  const maxVolume = 1; // Maximum amplitude

  // Helper: Generate a single sine wave with random wavelength deviation
  function generateSineWave(noiseType: typeof noiseTypes[number], staggerOffset: number): Float32Array {
    const buffer = new Float32Array(totalSamples);
    let time = staggerOffset / sampleRate; // Start time with stagger
    let wavelength = baseWavelength; // Start with the base wavelength
    let amplitude = 0.5; // Initial volume

    for (let i = 0; i < totalSamples; i++) {
      const t = time * Math.PI * 2 / wavelength; // Convert time to phase

      // Generate noise based on type
      let noise = 0;
      switch (noiseType) {
        case "gray":
          noise = Math.random() * 2 - 1; // Wideband noise
          break;
        case "pink":
          noise = ((Math.random() + Math.random() - 1) * 0.5); // Reduced high-frequency content
          break;
        case "red":
          noise = (Math.random() - 0.5) * 0.3; // Smoothed for low-frequency emphasis
          break;
        case "green":
          noise = Math.sin(Math.random() * Math.PI); // Moderate midrange variation
          break;
      }

      // Adjust amplitude and filter sharpness
      const scaledNoise = noise * amplitude;
      buffer[i] += Math.sin(t) * scaledNoise;

      // Increment time
      time += 1 / sampleRate;

      // Randomly adjust wavelength periodically
      if (i % (sampleRate / 10) === 0) {
        wavelength = baseWavelength * (1 + (Math.random() * 2 - 1) * maxDeviation);
        amplitude = Math.random() * maxVolume;
      }
    }
    return buffer;
  }

  // Generate sine waves for each noise type with staggered starts
  for (let i = 0; i < sineWavesCount; i++) {
    const staggerOffset = Math.random() * sampleRate; // Random stagger offset < 1 second
    sineWaves.push(generateSineWave(noiseTypes[i], staggerOffset));
  }

  // Combine all sine waves into a single buffer
  const combinedBuffer = new Float32Array(totalSamples);
  sineWaves.forEach((wave) => {
    for (let i = 0; i < totalSamples; i++) {
      combinedBuffer[i] += wave[i] / sineWavesCount; // Normalize by number of waves
    }
  });

  // Encode and save the combined audio
  const wavData = await WavEncoder.encode({
    sampleRate,
    channelData: [combinedBuffer]
  });

  fs.writeFileSync("output_sine_noise.wav", Buffer.from(wavData));
  console.log("Audio file saved as output_sine_noise.wav");
}

generateContinualSineWaves().catch(console.error);
