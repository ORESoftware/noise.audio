#!/usr/bin/env node
'use strict';

import * as fs from 'fs';
// @ts-ignore
import * as WavEncoder from "wav-encoder";

const sampleRate = 44100; // Standard audio sample rate
const duration = 6 * 60; // 6 minutes in seconds
const minWavelength = 5; // Minimum wavelength in seconds
const maxWavelength = 7; // Maximum wavelength in seconds
const maxChangeRate = 0.05; // Maximum 5% change in volume/pitch over 2 seconds
const minVolume = 0.8; // Minimum volume as a fraction of the maximum

const noiseTypes = ["pink", "gray", "brown", "white"] as const; // 4 noise types
const wavesPerType = 7; // 7 waves per noise type
const totalWaves = noiseTypes.length * wavesPerType; // Total of 28 waves

async function generateSmoothNoise() {
  const totalSamples = sampleRate * duration;

  // Helper: Generate noise based on type
  function generateNoiseSample(noiseType: typeof noiseTypes[number]): number {
    const random = Math.random;
    switch (noiseType) {
      case "gray":
        return random() * 2 - 1; // Wideband noise
      case "pink":
        return (random() + random() - 1) * 0.5; // Pink noise (less high frequencies)
      case "brown":
        return (random() - 0.5) * 0.3; // Brown (red) noise (low frequencies)
      case "white":
        return random() * 2 - 1; // White noise
      default:
        return 0;
    }
  }

  // Helper: Linearly interpolate between two values
  function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  // Helper: Find the maximum absolute value in a buffer
  function findMaxAmplitude(buffer: Float32Array): number {
    let max = 0;
    for (let i = 0; i < buffer.length; i++) {
      const absValue = Math.abs(buffer[i]);
      if (absValue > max) {
        max = absValue;
      }
    }
    return max;
  }

  // Initialize state for all waves
  const waves = Array.from({ length: totalWaves }, (_, i) => {
    const noiseType = noiseTypes[Math.floor(i / wavesPerType)];
    return {
      noiseType,
      currentWavelength: minWavelength + Math.random() * (maxWavelength - minWavelength),
      nextWavelength: minWavelength + Math.random() * (maxWavelength - minWavelength),
      amplitude: 1.0, // Start at max volume
      nextAmplitude: minVolume + Math.random() * (1 - minVolume), // Randomized within min/max bounds
      phase: 0,
      transitionSamples: 0,
      envelopeTime: 0,
      envelopeCycleLength: minWavelength + Math.random() * (maxWavelength - minWavelength),
    };
  });

  // Process audio buffer
  const combinedBuffer = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    for (const wave of waves) {
      // Smooth transitions
      if (wave.transitionSamples >= wave.currentWavelength * sampleRate) {
        wave.currentWavelength = wave.nextWavelength;
        wave.nextWavelength = minWavelength + Math.random() * (maxWavelength - minWavelength);
        wave.amplitude = wave.nextAmplitude;
        wave.nextAmplitude = minVolume + Math.random() * (1 - minVolume);
        wave.transitionSamples = 0; // Reset transition samples
      }

      // Calculate interpolated parameters
      const t = wave.transitionSamples / (wave.currentWavelength * sampleRate);
      const interpolatedWavelength = lerp(wave.currentWavelength, wave.nextWavelength, t);
      const interpolatedAmplitude = lerp(wave.amplitude, wave.nextAmplitude, t);

      // Generate the sine wave value modulated by noise
      const frequency = 1 / interpolatedWavelength;
      const sineValue = Math.sin(2 * Math.PI * frequency * wave.phase);
      const noiseValue = generateNoiseSample(wave.noiseType);

      // Apply smooth envelope
      const envelopeProgress = (wave.envelopeTime / wave.envelopeCycleLength) % 1; // Normalize to [0, 1]
      const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * envelopeProgress); // Smooth sine envelope
      combinedBuffer[i] += sineValue * noiseValue * interpolatedAmplitude * envelope;

      // Increment counters
      wave.phase += 1 / sampleRate; // Increment phase
      wave.transitionSamples++;
      wave.envelopeTime += 1 / sampleRate; // Increment envelope time

      // Reset envelope cycle if necessary
      if (wave.envelopeTime >= wave.envelopeCycleLength) {
        wave.envelopeTime = 0;
        wave.envelopeCycleLength = minWavelength + Math.random() * (maxWavelength - minWavelength); // New random cycle length
      }
    }
  }

  // Normalize the combined buffer to prevent clipping
  const maxAmplitude = findMaxAmplitude(combinedBuffer);
  if (maxAmplitude > 1) {
    for (let i = 0; i < combinedBuffer.length; i++) {
      combinedBuffer[i] /= maxAmplitude;
    }
  }

  // Encode and save the combined audio
  const wavData = await WavEncoder.encode({
    sampleRate,
    channelData: [combinedBuffer],
  });

  fs.writeFileSync("smooth_noise_output_final.wav", Buffer.from(wavData));
  console.log("Audio file saved as smooth_noise_output_final.wav");
}

generateSmoothNoise().catch(console.error);
