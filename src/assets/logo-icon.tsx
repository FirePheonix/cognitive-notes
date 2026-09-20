import logoImg from "./logo-image.png";

export default function LogoIcon({
  className = "w-6 h-6",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={logoImg}
      alt="Cognitive Notes logo"
      className={className}
      {...props}
    />
  );
}
