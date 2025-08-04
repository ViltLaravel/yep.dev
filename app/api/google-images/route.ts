import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (
    !imageUrl ||
    !imageUrl.startsWith('https://lh3.googleusercontent.com/')
  ) {
    return new NextResponse('Invalid image URL', { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Image fetch error:', err);
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
