/* ─────────────────────────────────────────────────────────────────────────
 * Brand marks for the showreel hero: the clients in the "Trusted by" row and
 * the platforms beside each reel's view counts. Plain SVG, no "use client":
 * the section renders them on the server, so they add no JavaScript.
 *
 * The client marks are the full-colour versions from tech-stack-icons (MIT),
 * inlined so the block needs no extra package. Every one has colour on both
 * light and dark pages. Their ids are prefixed per mark, since the same
 * mark appears twice in the looping row.
 * ───────────────────────────────────────────────────────────────────────── */

export const FigmaMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-figma-a)">
      <path
        fill="#0acf83"
        d="M33.333 100C42.533 100 50 92.533 50 83.333V66.667H33.333c-9.2 0-16.666 7.466-16.666 16.666S24.133 100 33.333 100"
      />
      <path
        fill="#a259ff"
        d="M16.667 50c0-9.2 7.466-16.667 16.666-16.667H50v33.334H33.333c-9.2 0-16.666-7.467-16.666-16.667"
      />
      <path
        fill="#f24e1e"
        d="M16.667 16.667C16.667 7.467 24.133 0 33.333 0H50v33.333H33.333c-9.2 0-16.666-7.466-16.666-16.666"
      />
      <path
        fill="#ff7262"
        d="M50 0h16.667c9.2 0 16.666 7.467 16.666 16.667s-7.466 16.666-16.666 16.666H50z"
      />
      <path
        fill="#1abcfe"
        d="M83.333 50c0 9.2-7.466 16.667-16.666 16.667S50 59.2 50 50s7.467-16.667 16.667-16.667S83.333 40.8 83.333 50"
      />
    </g>
    <defs>
      <clipPath id="showreel-figma-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const SlackMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g fillRule="evenodd" clipPath="url(#showreel-slack-a)" clipRule="evenodd">
      <path
        fill="#36c5f0"
        d="M36.591-.001c-5.517.004-9.981 4.481-9.977 9.998-.004 5.517 4.464 9.994 9.981 9.998h9.982V10C46.58 4.484 42.112.007 36.59 0q.006 0 0 0m0 26.667H9.981C4.466 26.67-.003 31.146 0 36.664c-.008 5.516 4.46 9.993 9.978 10.002H36.59c5.517-.004 9.986-4.481 9.982-9.998.004-5.521-4.465-9.998-9.982-10.002"
      />
      <path
        fill="#2eb67d"
        d="M99.8 36.664c.004-5.517-4.465-9.994-9.981-9.998-5.517.004-9.986 4.48-9.982 9.998v10.002h9.981c5.517-.004 9.986-4.481 9.982-10.002m-26.614 0V9.997c.005-5.513-4.46-9.99-9.977-9.998-5.517.004-9.986 4.481-9.982 9.998v26.667c-.008 5.516 4.461 9.993 9.978 10.002 5.517-.004 9.986-4.481 9.981-10.002"
      />
      <path
        fill="#ecb22e"
        d="M63.205 99.999c5.517-.004 9.986-4.481 9.982-9.998.004-5.517-4.465-9.994-9.982-9.998h-9.982V90c-.004 5.513 4.465 9.99 9.982 9.998m0-26.67h26.614c5.516-.005 9.985-4.482 9.981-9.999.008-5.517-4.46-9.994-9.977-10.002H63.209c-5.517.004-9.986 4.481-9.982 9.998-.004 5.521 4.461 9.998 9.978 10.002"
      />
      <path
        fill="#e01e5a"
        d="M0 63.33c-.004 5.517 4.465 9.994 9.982 9.998 5.517-.004 9.986-4.481 9.982-9.998v-9.998H9.982C4.465 53.336-.004 57.813 0 63.33m26.614 0v26.667c-.008 5.516 4.46 9.993 9.978 10.002 5.516-.004 9.985-4.481 9.981-9.998V63.338c.008-5.517-4.46-9.994-9.977-10.002-5.521 0-9.986 4.477-9.982 9.994"
      />
    </g>
    <defs>
      <clipPath id="showreel-slack-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const SupabaseMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-supabase-a)">
      <path
        fill="url(#showreel-supabase-b)"
        d="M57.894 98.338c-2.554 3.217-7.734 1.454-7.796-2.654l-.9-60.082h40.4c7.316 0 11.397 8.452 6.847 14.182z"
      />
      <path
        fill="url(#showreel-supabase-c)"
        fillOpacity=".2"
        d="M57.894 98.338c-2.554 3.217-7.734 1.454-7.796-2.654l-.9-60.082h40.4c7.316 0 11.397 8.452 6.847 14.182z"
      />
      <path
        fill="#3ecf8e"
        d="M41.464 1.66c2.555-3.217 7.735-1.454 7.796 2.654l.395 60.082H9.76c-7.318 0-11.399-8.452-6.848-14.182z"
      />
    </g>
    <defs>
      <linearGradient
        id="showreel-supabase-b"
        x1="49.198"
        x2="85.103"
        y1="48.924"
        y2="63.982"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#249361" />
        <stop offset="1" stopColor="#3ecf8e" />
      </linearGradient>
      <linearGradient
        id="showreel-supabase-c"
        x1="33.279"
        x2="49.654"
        y1="27.128"
        y2="57.953"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopOpacity="0" />
      </linearGradient>
      <clipPath id="showreel-supabase-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const CloudflareMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-cloudflare-a)">
      <path
        fill="#fff"
        d="m79.046 46.295-2.075-.83c-9.75 21.939-48.539 8.601-50.873 15.128-.39 4.408 21.182.838 36.604 1.585 4.702.228 7.06 3.778 5.064 9.564l3.933.012C76.236 57.61 90.716 64.83 91.32 60.16c-.994-3.069-16.64 0-12.275-13.865"
      />
      <path
        fill="#f4811f"
        d="M68.88 69.323c.622-2.074.415-4.149-.623-5.394-1.037-1.245-2.49-2.074-4.357-2.282l-36.1-.415c-.207 0-.414-.207-.622-.207q-.31-.312 0-.623c.208-.415.415-.622.83-.622l36.307-.415c4.357-.207 8.922-3.735 10.581-7.884l2.075-5.394c0-.208.207-.415 0-.623C74.69 34.885 65.145 27 53.941 27c-10.373 0-19.294 6.639-22.406 15.975-2.075-1.452-4.564-2.282-7.469-2.074-4.979.414-8.92 4.563-9.543 9.543-.208 1.245 0 2.49.207 3.734C6.64 54.386 0 61.025 0 69.323c0 .83 0 1.453.207 2.283 0 .415.415.622.623.622h66.597c.415 0 .83-.207.83-.622z"
      />
      <path
        fill="#faad3f"
        d="M80.29 46.087h-1.037c-.207 0-.415.207-.622.415l-1.453 4.98c-.622 2.074-.414 4.149.623 5.393 1.037 1.245 2.49 2.075 4.357 2.283l7.676.415c.207 0 .415.207.623.207q.31.311 0 .622c-.208.416-.415.623-.83.623l-7.884.415c-4.357.207-8.921 3.734-10.58 7.883l-.416 1.868c-.207.207 0 .622.415.622h27.386q.622 0 .622-.622c.415-1.66.83-3.527.83-5.395 0-10.788-8.921-19.709-19.71-19.709"
      />
    </g>
    <defs>
      <clipPath id="showreel-cloudflare-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const AtlassianMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-atlassian-a)">
      <path
        fill="url(#showreel-atlassian-b)"
        d="M29.634 46.195a2.853 2.853 0 0 0-3.99-.538 2.96 2.96 0 0 0-.835 1.041L.31 95.713a2.93 2.93 0 0 0 2.619 4.239h34.135a2.81 2.81 0 0 0 2.62-1.62c7.367-15.217 2.9-38.353-10.05-52.137"
      />
      <path
        fill="#2684ff"
        d="M47.642 1.59a64.66 64.66 0 0 0-3.777 63.826l16.458 32.916a2.93 2.93 0 0 0 2.62 1.62H97.07a2.92 2.92 0 0 0 2.929-2.93 3 3 0 0 0-.303-1.309L52.625 1.577a2.756 2.756 0 0 0-4.983 0z"
      />
    </g>
    <defs>
      <linearGradient
        id="showreel-atlassian-b"
        x1="43.121"
        x2="17.249"
        y1="53.686"
        y2="98.497"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#0052cc" />
        <stop offset=".92" stopColor="#2684ff" />
      </linearGradient>
      <clipPath id="showreel-atlassian-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const AirtableMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-airtable-a)">
      <path
        fill="#fcb400"
        d="M44.654 9.056 7.37 24.483c-2.073.858-2.052 3.804.034 4.63l37.44 14.847a13.9 13.9 0 0 0 10.242 0l37.439-14.847c2.086-.826 2.108-3.771.034-4.63L55.277 9.057a13.9 13.9 0 0 0-10.624 0"
      />
      <path
        fill="#18bfff"
        d="M53.287 52.067v37.089a2.498 2.498 0 0 0 3.418 2.322l41.718-16.193A2.5 2.5 0 0 0 100 72.963V35.875a2.498 2.498 0 0 0-3.418-2.322L54.864 49.745a2.5 2.5 0 0 0-1.577 2.322"
      />
      <path
        fill="#f82b60"
        d="m43.545 53.98-12.381 5.98-1.257.607L3.77 73.09C2.115 73.889 0 72.681 0 70.841V36.03c0-.666.341-1.24.8-1.673q.282-.282.632-.475c.624-.375 1.515-.475 2.273-.175L43.337 49.41c2.014.8 2.172 3.622.208 4.571"
      />
      <path
        fill="#000"
        fillOpacity=".25"
        d="m43.545 53.98-12.381 5.98L.799 34.356q.284-.281.633-.474c.624-.375 1.515-.475 2.273-.175L43.337 49.41c2.014.8 2.172 3.622.208 4.571"
      />
    </g>
    <defs>
      <clipPath id="showreel-airtable-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

export const AsanaMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <path
      fill="#f06a6a"
      fillRule="evenodd"
      d="M78.252 52.614c-12.011 0-21.749 9.364-21.749 20.916 0 11.55 9.738 20.914 21.749 20.914S100 85.081 100 73.53s-9.737-20.916-21.748-20.916m-56.504.002C9.738 52.616 0 61.978 0 73.53c0 11.55 9.737 20.914 21.748 20.914s21.75-9.363 21.75-20.914-9.738-20.914-21.75-20.914m50-26.146c0 11.552-9.737 20.916-21.748 20.916S28.252 38.022 28.252 26.47c0-11.55 9.737-20.914 21.748-20.914S71.748 14.92 71.748 26.47"
      clipRule="evenodd"
    />
  </svg>
);

export const GitLabMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <path fill="#e24329" d="m50 96.118 18.413-56.67H31.587z" />
    <path fill="#fc6d26" d="M50 96.117 31.587 39.448H5.782z" />
    <path
      fill="#fca326"
      d="M5.782 39.448.187 56.67a3.81 3.81 0 0 0 1.384 4.262L50 96.117z"
    />
    <path
      fill="#e24329"
      d="M5.782 39.449h25.805L20.497 5.317c-.57-1.756-3.055-1.756-3.625 0z"
    />
    <path fill="#fc6d26" d="m50 96.117 18.413-56.669h25.805z" />
    <path
      fill="#fca326"
      d="m94.218 39.448 5.595 17.222a3.81 3.81 0 0 1-1.385 4.262L50 96.117z"
    />
    <path
      fill="#e24329"
      d="M94.218 39.449H68.413l11.09-34.132c.57-1.756 3.055-1.756 3.626 0z"
    />
  </svg>
);

export const WebflowMark = () => (
  <svg aria-hidden fill="none" viewBox="0 0 100 100">
    <g clipPath="url(#showreel-webflow-a)">
      <path
        fill="#4353ff"
        d="M.777.777v98.447h98.447V.777zm56.187 32.59s3.116 23.481 3.116 24.565l4.52-14.156h-.032c1.994-5.36 5.921-10.409 13.4-10.409L67.372 58.953a14.3 14.3 0 0 1-5.21 7.231 14.46 14.46 0 0 1-8.5 2.776s-3.117-21.994-3.117-22.49L45.87 58.552C43.783 63.91 39.733 68.96 32.254 68.96l-5.86-35.56a11.7 11.7 0 0 1 7.663 3.113 11.56 11.56 0 0 1 3.65 7.386s.779 13.042.779 14.063l5.516-14.187c1.994-5.36 5.795-10.408 12.962-10.408"
      />
    </g>
    <defs>
      <clipPath id="showreel-webflow-a">
        <path fill="#fff" d="M0 0h100v100H0z" />
      </clipPath>
    </defs>
  </svg>
);

/* Platform marks for the view counts, drawn at 24 × 24 in each brand's own
 * colour. X has none, so it takes the text colour. Solid fills only: a
 * gradient (Instagram's) would need an SVG id, and ids inside the hidden
 * wheel's copy of a caption don't resolve. Pass your own `icon` to override. */
export const YouTubeMark = () => (
  <svg aria-hidden viewBox="0 0 24 24">
    <path
      d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8Z"
      fill="#FF0033"
    />
    <path d="M9.75 15.02V8.98L15.5 12l-5.75 3.02Z" fill="#FFFFFF" />
  </svg>
);

export const LinkedInMark = () => (
  <svg aria-hidden viewBox="0 0 24 24">
    <rect fill="#0A66C2" height="24" rx="4" width="24" />
    <path
      d="M19.2 19.2h-2.9v-4.6c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4v4.7h-2.9V9.9h2.8v1.3c.4-.7 1.3-1.5 2.8-1.5 3 0 3.5 2 3.5 4.5v5ZM6.9 8.6a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm1.4 10.6H5.4V9.9h2.9v9.3Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const XMark = () => (
  <svg aria-hidden fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.9 2h6.4l4.4 5.8L18.9 2Zm-1.1 18.1h1.7L8.3 3.8H6.5l11.3 16.3Z" />
  </svg>
);

export const InstagramMark = () => (
  <svg
    aria-hidden
    fill="none"
    stroke="#E1306C"
    strokeWidth={2.2}
    viewBox="0 0 24 24"
  >
    <rect height="18" rx="5" width="18" x="3" y="3" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" fill="#E1306C" r="1.1" stroke="none" />
  </svg>
);
