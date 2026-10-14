import { useState } from 'preact/hooks';
import { thumb } from '../lib/url';

// Галерея на странице товара: большое фото + миниатюры (если фото больше одного).
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  return (
    <div class="gal">
      <div class="gal__main">
        <img src={thumb(images[i], 1000)} alt={alt} width={1000} height={1000} />
      </div>
      {images.length > 1 && (
        <div class="gal__thumbs">
          {images.map((src, n) => (
            <button type="button" class={`gal__th${n === i ? ' is-on' : ''}`} aria-label={`Фото ${n + 1}`} onClick={() => setI(n)}>
              <img src={thumb(src)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
