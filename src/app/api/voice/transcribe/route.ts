import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client (will be null if API key not set)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!validTypes.some(type => audioFile.type.startsWith(type.split('/')[0]))) {
      return NextResponse.json(
        { error: 'Invalid audio format. Supported: webm, mp4, mp3, wav, ogg' },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB for Whisper)
    const maxSize = 25 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    if (!openai) {
      // Mock response for development without API key
      console.log('No OPENAI_API_KEY configured, returning mock transcription');
      return NextResponse.json({
        text: 'This is a mock transcription. Add your OPENAI_API_KEY to enable real voice transcription.',
        duration: 3,
        confidence: 0.95,
      });
    }

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      prompt: 'This is a business onboarding conversation. The speaker may mention business names, addresses, phone numbers, services, and other business-related information.',
    });

    return NextResponse.json({
      text: transcription.text,
      duration: transcription.duration,
      confidence: 0.95, // Whisper doesn't provide confidence scores
      segments: transcription.segments,
    });
  } catch (error) {
    console.error('Transcription error:', error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
