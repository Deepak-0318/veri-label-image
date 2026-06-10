import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useLocation } from "react-router-dom";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  let pathname = "";
  try {
    pathname = useLocation().pathname;
  } catch {
    pathname = "";
  }
  const isAnnotationTask =
    /^\/tasks\/[^/]+\/perform/.test(pathname) || /^\/annotate\//.test(pathname);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isAnnotationTask ? "bottom-left" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
