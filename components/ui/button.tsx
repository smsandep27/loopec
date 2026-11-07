import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-violet-950 text-white shadow-[0_8px_22px_-12px_rgba(63,40,121,0.65)] hover:-translate-y-0.5 hover:bg-violet-900",
        secondary:
          "border border-violet-200 bg-white text-violet-950 hover:border-violet-300 hover:bg-violet-50",
        quiet: "text-slate-600 hover:bg-slate-100 hover:text-violet-950",
      },
      size: {
        sm: "min-h-10 px-4 text-[13px]",
        md: "min-h-12 px-5 text-sm",
        lg: "min-h-[54px] px-6 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
