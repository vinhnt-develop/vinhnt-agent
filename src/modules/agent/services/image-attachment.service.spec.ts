import {
  MAX_IMAGES_PER_MESSAGE,
  prepareUserContentParts,
} from './image-attachment.service';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl6sAAAAASUVORK5CYII=';

describe('image attachment service', () => {
  it('returns undefined when there are no images', () => {
    expect(prepareUserContentParts('hello', undefined)).toBeUndefined();
    expect(prepareUserContentParts('hello', [])).toBeUndefined();
  });

  it('builds a text part plus image_url parts', () => {
    const parts = prepareUserContentParts('what is this?', [
      {
        dataUrl: `data:image/png;base64,${PNG_1X1}`,
        mimeType: 'image/png',
        name: 'screenshot.png',
      },
    ]);

    expect(parts).toEqual([
      { type: 'text', text: 'what is this?' },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${PNG_1X1}`,
          detail: 'auto',
        },
      },
    ]);
  });

  it('rejects a MIME mismatch', () => {
    expect(() =>
      prepareUserContentParts('x', [
        {
          dataUrl: `data:image/png;base64,${PNG_1X1}`,
          mimeType: 'image/jpeg',
        },
      ]),
    ).toThrow('does not match data URL');
  });

  it('rejects content that does not match the declared image type', () => {
    expect(() =>
      prepareUserContentParts('x', [
        { dataUrl: 'data:image/png;base64,YWJj' },
      ]),
    ).toThrow('not a valid image/png');
  });

  it('caps the number of images', () => {
    expect(() =>
      prepareUserContentParts(
        'x',
        Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, () => ({
          dataUrl: `data:image/png;base64,${PNG_1X1}`,
        })),
      ),
    ).toThrow('Too many images');
  });
});
