import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/home/Hero";
import { TagStrip } from "@/components/home/TagStrip";
import { FeatureRows } from "@/components/home/FeatureRows";
import { MiniCards } from "@/components/home/MiniCards";
import { Audience } from "@/components/home/Audience";
import { Pricing } from "@/components/home/Pricing";
import { Faq } from "@/components/home/Faq";
import { FooterCta } from "@/components/home/FooterCta";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <TagStrip />
        <FeatureRows />
        <MiniCards />
        <Audience />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}
