import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  CircleHelp,
  Handshake,
  LockKeyhole,
  MapPin,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

const principles = [
  {
    number: "01",
    icon: BadgeCheck,
    title: "A real campus community",
    description:
      "College email and ID checks help keep the marketplace within your community.",
  },
  {
    number: "02",
    icon: Boxes,
    title: "Useful things, in one place",
    description:
      "Books, tech, furniture and the everyday essentials students already pass along.",
  },
  {
    number: "03",
    icon: MapPin,
    title: "Meet where you study",
    description:
      "Agree on an approved campus pickup point and coordinate directly with each other.",
  },
];

const guardrails = [
  { icon: ShieldCheck, label: "Verified members" },
  { icon: LockKeyhole, label: "Private ID documents" },
  { icon: Handshake, label: "Campus pickup" },
];

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="LOOPEC home">
            <BrandMark />
            <span className="brand-wordmark">LOOPEC</span>
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-caption">Campus marketplace</span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#community">Our community</a>
          </nav>

          <Button asChild size="sm" className="header-action">
            <Link href="/auth/sign-up">
              Join your campus <MoveUpRight aria-hidden="true" size={15} />
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="hero-section page-shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Made for your campus community
            </div>
            <h1>
              Good things
              <br />
              <span className="headline-accent">find their next</span>
              <br />
              <span className="headline-last">place here.</span>
            </h1>
            <p className="hero-description">
              A private marketplace for the people who learn, teach and work on
              your campus. Find what you need. Pass along what you don’t.
            </p>
            <div className="hero-actions">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">
                  Get started <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </Button>
              <a className="text-link" href="#community">
                Why LOOPEC <ArrowDownRight aria-hidden="true" size={16} />
              </a>
            </div>
            <div className="hero-note">
              <span className="hero-note-icon">
                <UsersRound aria-hidden="true" size={15} />
              </span>
              One campus. One trusted community.
            </div>
          </div>

          <div className="hero-art" aria-label="The LOOPEC campus exchange">
            <div className="art-orbit art-orbit-outer" />
            <div className="art-orbit art-orbit-inner" />
            <div className="art-spark art-spark-one"><Sparkles size={17} /></div>
            <div className="art-spark art-spark-two" />
            <div className="loop-card">
              <div className="loop-card-topline">
                <span className="loop-card-label">THE CAMPUS LOOP</span>
                <span className="live-indicator"><span /> COMMUNITY FIRST</span>
              </div>
              <div className="loop-illustration">
                <div className="loop-line loop-line-one" />
                <div className="loop-line loop-line-two" />
                <div className="loop-line loop-line-three" />
                <div className="loop-node loop-node-find">
                  <span className="loop-node-icon"><BookOpen size={19} /></span>
                  <span className="loop-node-copy"><b>Find</b><small>Good things nearby</small></span>
                  <span className="loop-node-index">01</span>
                </div>
                <div className="loop-node loop-node-connect">
                  <span className="loop-node-icon loop-node-icon-light"><Handshake size={19} /></span>
                  <span className="loop-node-copy"><b>Connect</b><small>Talk with a member</small></span>
                  <span className="loop-node-index">02</span>
                </div>
                <div className="loop-node loop-node-meet">
                  <span className="loop-node-icon loop-node-icon-sand"><MapPin size={19} /></span>
                  <span className="loop-node-copy"><b>Meet</b><small>Pick up on campus</small></span>
                  <span className="loop-node-index">03</span>
                </div>
                <div className="loop-center-mark"><BrandMark compact /></div>
              </div>
              <div className="loop-card-footer">
                <span>BUY · SELL · PASS IT ON</span>
                <span className="loop-footer-check"><ShieldCheck size={14} /> VERIFIED COMMUNITY</span>
              </div>
            </div>
            <div className="art-caption art-caption-top">
              <span className="caption-kicker">A simpler kind of exchange</span>
              <span>Made to stay close.</span>
            </div>
            <div className="art-caption art-caption-bottom">
              <span className="caption-mark"><CircleHelp size={15} /></span>
              <span>Thoughtful by design</span>
            </div>
          </div>
        </section>

        <section className="trust-strip page-shell" aria-label="Marketplace principles">
          <div className="trust-strip-intro">A better campus exchange starts with trust.</div>
          <div className="trust-list">
            {guardrails.map(({ icon: Icon, label }) => (
              <div className="trust-item" key={label}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="how-section page-shell" id="how-it-works">
          <div className="section-heading">
            <div>
              <p className="section-kicker">A little more human</p>
              <h2>Keep good things<br /><span>in good company.</span></h2>
            </div>
            <p className="section-intro">
              LOOPEC brings the people and pickup points of one college together,
              so an everyday exchange feels a little more familiar.
            </p>
          </div>
          <div className="principle-grid">
            {principles.map(({ number, icon: Icon, title, description }) => (
              <article className="principle-card" key={number}>
                <div className="principle-card-top">
                  <span className="principle-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span className="principle-number">{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="principle-rule" />
              </article>
            ))}
          </div>
        </section>

        <section className="community-section" id="community">
          <div className="community-inner page-shell">
            <div className="community-symbol"><BrandMark compact /></div>
            <div className="community-copy">
              <p className="section-kicker section-kicker-light">Built around the people here</p>
              <h2>More than a marketplace.<br /><span>A campus that shares.</span></h2>
              <p>
                Students, faculty and staff can all take part. Every member is
                verified before joining, and every listing is made for the same
                campus community.
              </p>
            </div>
            <div className="community-aside">
              <span className="aside-line" />
              <span>Designed for one college at a time.</span>
              <span className="aside-caption">LOOPEC · A CiGaRa Technologies product</span>
            </div>
          </div>
        </section>

        <section className="closing-section page-shell">
          <div>
            <p className="section-kicker">A thoughtful loop starts here</p>
            <h2>Find a little more<br /><span>right where you are.</span></h2>
          </div>
          <div className="closing-aside">
            <p>
              LOOPEC is being built for a verified college community, with
              private identity checks and campus pickup at its heart.
            </p>
            <a className="text-link text-link-purple" href="#how-it-works">
              Explore the approach <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer page-shell">
        <Link className="brand footer-brand" href="/" aria-label="LOOPEC home">
          <BrandMark compact />
          <span className="brand-wordmark">LOOPEC</span>
        </Link>
        <span className="footer-credit">A CiGaRa Technologies product · CiGaRa Group</span>
        <nav className="flex gap-4 text-xs text-[#827b87]" aria-label="Policies">
          <Link className="hover:text-violet-900" href="/about">About</Link>
          <Link className="hover:text-violet-900" href="/terms">Terms</Link>
          <Link className="hover:text-violet-900" href="/privacy">Privacy</Link>
        </nav>
        <span className="footer-copyright">© LOOPEC</span>
      </footer>
    </>
  );
}
