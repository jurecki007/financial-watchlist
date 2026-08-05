import { redirect } from "next/navigation";

/**
 * `/about` is a section, not a page. It resolves to the first tab rather than
 * 404ing, because the nav links here and a URL a visitor can reasonably type
 * should not be a dead end.
 */
export default function AboutIndex() {
  redirect("/about/project");
}
