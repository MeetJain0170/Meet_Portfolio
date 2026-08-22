import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { skills } from "@/data/skills";
import { experience } from "@/data/experience";
import { socials, contact } from "@/data/socials";

/**
 * The visual graph is the presentation layer. This is the semantic
 * information layer underneath it — real headings, real paragraphs, real
 * anchor tags — for screen readers, search engines, and no-JS clients.
 * Visually hidden by default; becomes visible if focus lands inside it
 * (e.g. via the "Skip visual experience" link).
 */
export default function AccessibleFallback() {
  return (
    <section id="text-portfolio" className="sr-fallback">
      <h1>{profile.name} — AI / ML Engineer </h1>
      <p>{profile.tagline}</p>
      <p>{profile.aboutSentence}</p>

      <h2>Projects</h2>
      {projects.map((p) => (
        <article key={p.id}>
          <h3>{p.label}</h3>
          <p>{p.description}</p>
          {p.children
            ?.filter((c) => c.action)
            .map((c) => (
              <a key={c.id} href={c.action!.href} target="_blank" rel="noopener noreferrer">
                {c.label} — {p.label}
              </a>
            ))}
        </article>
      ))}

      <h2>Skills</h2>
      {skills.map((cluster) => (
        <p key={cluster.id}>
          <b>{cluster.label}:</b> {cluster.children?.map((c) => c.label).join(", ")}
        </p>
      ))}

      <h2>Experience</h2>
      {experience.map((e) => (
        <article key={e.id}>
          <h3>{e.label}</h3>
          <p>{e.meta?.join(" · ")}</p>
          <p>{e.description}</p>
        </article>
      ))}

      <h2>Contact &amp; Socials</h2>
      {[...contact, ...socials].map((c) => (
        <a key={c.id} href={c.action?.href} target="_blank" rel="noopener noreferrer">
          {c.label}
        </a>
      ))}
    </section>
  );
}
