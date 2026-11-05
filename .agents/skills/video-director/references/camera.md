# Camera and pace

The camera goes where the action is. In the benchmarks it pushes into one button (@motionbyjawad), into the phone (@simo.dsgn), into each dashboard panel in turn (@_code_and_chill_); Screen Studio built a product on doing this automatically. Our videos held one wide shot, so a 4px blur or a 1.32× scale was too small to see on a phone.

Status: the push-in is **Built**; pace rules apply now.

## The push-in

Every feature scene pushes in on its focus element, then pulls back:

1. **Wide** on the title beat: the whole component, the caption arriving.
2. **Push in** as the cause happens, over about 720ms, eased, until the focus fills about half the frame's width: zoom = clamp(0.5 × frame width ÷ focus width, 1.15, 1.6). The focus is every visible match of the mark's target together (a selector matching each line of a quote frames the whole quote); 2.2× on one line cropped the frame badly in testing, so 1.6× is the ceiling.
3. **Hold** on the result, the focus ring and its value on screen.
4. **Pull back** with the next scene's title beat, never in the middle of a motion.

Rules, from stageshow's Scrolling and the camera:

- **One push-in per scene,** in and out.
- **The cursor holds still while the view moves;** the motion is the camera's, not the hand's.
- **Track, don't aim.** The camera's focus is the element as it is drawn each frame (the same lookup as the ring), so a tile that grows or a quote that reflows stays framed.
- **Frame the wide shot as a good still first;** the zoom never rescues a weak frame.
- **No push-in for width or theme scenes:** the whole component is the proof there.
- **No motion blur, no shake, no rotation.** A slow 1 to 2° tilt on a Card frame is allowed in the hook only.

## Pace

The benchmark reels cut or change something every 1 to 3 seconds; nothing holds still longer than the eye needs to read it.

| Length | Hook | Feature scenes | End |
|---|---|---|---|
| 15s (default) | 1.2 to 1.8s | 2 to 3, 2.5 to 3.5s each | 2s |
| 30s | 1.5s | 4 to 6, 3 to 4s each | 2.5s |
| 45s | 1.5s | 6 to 8, 3 to 4s each, then Install 2.5s | 2.5s |

- **Something moves every half second:** the component, the camera, the caption or the ring. A hold is a hold on a result being read, never dead air.
- **Motion plays at 1×.** A 0.25× replay (labelled) only for motion under 400ms that can't be seen at 1×, at most once per video.
- **Cut on the beat.** When there is music, scene changes land on its beats (`references/sound.md`).
- **Loop the ending.** The last frame of the end card fades back to the hook's first frame, so a replay feels seamless and the reel loops; replays count as watch time.
