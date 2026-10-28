// The feature sphere section imports "./image-sphere". Installed, the
// sphere's files sit next to it in components/blocks (they ship with the
// section). In this repo they live in registry/blocks, so this re-export
// stands in for them. It isn't listed in registry.json: never shipped.
export * from "../blocks/image-sphere";
