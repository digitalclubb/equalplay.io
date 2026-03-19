/**
 * Logo: whistle icon (SVG) + "Equal Play" wordmark in Outfit + strapline.
 * The whistle is extracted from the brand SVG. Renders inline, no background block.
 */
export function createLogo(): string {
  return `
    <div class="logo" role="img" aria-label="Equal Play">
      <svg class="logo-whistle" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
        <g fill="#e75333">
          <path d="M42.429,85.098l-7.46-13.395l39.167-39.192c15.618-12.947,28.398,1.138,25.433,16.215C95.421,69.811,81.16,72.085,81.16,72.085C68.16,73.767,65,62.25,65,62.25L42.429,85.098z M38.669,85.52l-6.762-12.217L0,62.188l6.838,12.735L38.669,85.52z M68.111,69.697c-3.24-2.792-3.525-4.912-3.525-4.912l-3.014,2.736L68.111,69.697z M83.541,24.843c-6.641,0.041-11.96,5.519-11.96,5.519L32.454,69.811L0,58.846l37.747-38.21c9.375-9.49,18.786-4.784,18.786-4.784l5.539,1.844c3.655-4.917,11.055-3.07,12.762-1.761c3.643,2.793,2.587,6.035,2.193,6.74L83.541,24.843z M66.814,19.274l5.828,1.94C73.645,18.162,68.6,16.971,66.814,19.274z M60.6,35.187l-22.963-7.765l-8.13,8.088l22.962,7.765L60.6,35.187z"/>
        </g>
      </svg>
      <span class="logo-text">Equal <span class="logo-text-play">Play</span></span>
    </div>
  `;
}
