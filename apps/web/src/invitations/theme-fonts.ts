import {
  Bodoni_Moda,
  Cormorant_Garamond,
  Cormorant_SC,
  DM_Sans,
  Great_Vibes,
  Inter,
  Italiana,
  Lora,
  Manrope,
  Marcellus,
  Montserrat,
  Noto_Sans,
  Noto_Serif,
  Nunito_Sans,
} from "next/font/google";

const elegantHeading = Cormorant_Garamond({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-elegant-heading",
  weight: "variable",
});
const elegantBody = Montserrat({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-elegant-body",
  weight: "variable",
});
const islamicHeading = Marcellus({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-invitation-islamic-heading",
  weight: "400",
});
const islamicBody = Lora({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-islamic-body",
  weight: "variable",
});
const luxuryHeading = Bodoni_Moda({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-luxury-heading",
  weight: "variable",
});
const luxuryBody = Manrope({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-invitation-luxury-body",
  weight: "variable",
});
const minimalistHeading = Italiana({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-invitation-minimalist-heading",
  weight: "400",
});
const minimalistBody = Inter({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-minimalist-body",
  weight: "variable",
});
const cinematicHeading = Cormorant_SC({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-invitation-cinematic-heading",
  weight: ["300", "400", "500", "600", "700"],
});
const cinematicBody = DM_Sans({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-cinematic-body",
  weight: "variable",
});
const floralHeading = Great_Vibes({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-invitation-floral-heading",
  weight: "400",
});
const floralBody = Nunito_Sans({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-floral-body",
  weight: "variable",
});
const javaneseHeading = Noto_Serif({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-javanese-heading",
  weight: "variable",
});
const javaneseBody = Noto_Sans({
  display: "swap",
  preload: false,
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-invitation-javanese-body",
  weight: "variable",
});

export const invitationFontVariables = [
  elegantHeading.variable,
  elegantBody.variable,
  islamicHeading.variable,
  islamicBody.variable,
  luxuryHeading.variable,
  luxuryBody.variable,
  minimalistHeading.variable,
  minimalistBody.variable,
  cinematicHeading.variable,
  cinematicBody.variable,
  floralHeading.variable,
  floralBody.variable,
  javaneseHeading.variable,
  javaneseBody.variable,
].join(" ");
