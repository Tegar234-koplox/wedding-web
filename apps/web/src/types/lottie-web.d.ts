declare module "lottie-web" {
  type AnimationConfig = {
    autoplay?: boolean;
    container: Element;
    loop?: boolean;
    path: string;
    renderer?: "svg" | "canvas" | "html";
  };

  type AnimationItem = {
    destroy: () => void;
    pause: () => void;
    play: () => void;
  };

  const lottie: {
    loadAnimation: (config: AnimationConfig) => AnimationItem;
  };

  export default lottie;
}
