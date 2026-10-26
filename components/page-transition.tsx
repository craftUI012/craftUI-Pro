"use client";

// Off for now: pages open in place, with no sideways slide. Every page that
// uses <PageTransition> keeps it, so turning the slide back on is only this
// file: delete the line below and uncomment the original underneath. The
// slide keyframes (slide-from-right and the rest) are still in
// styles/globals.css.
export const PageTransition = ({ children }: { children: React.ReactNode }) =>
  children;

// The original: slides pages sideways on links marked
// transitionTypes={["nav-forward"]} / ["nav-back"].
//
// import { ViewTransition } from "react";
//
// export const PageTransition = ({ children }: { children: React.ReactNode }) => (
//   <ViewTransition
//     enter={{
//       default: "none",
//       "nav-back": "slide-from-left",
//       "nav-forward": "slide-from-right",
//     }}
//     exit={{
//       default: "none",
//       "nav-back": "slide-to-right",
//       "nav-forward": "slide-to-left",
//     }}
//     default="none"
//   >
//     {children}
//   </ViewTransition>
// );
