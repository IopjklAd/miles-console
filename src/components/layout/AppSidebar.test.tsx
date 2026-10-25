/**
 * Navigation test: the sidebar must expose every v1 destination, once, with
 * the right route — no dead links, no missing page.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MilesProvider } from "@/state/miles";
import { SettingsProvider } from "@/state/settings";

const NAV: Array<[href: string, label: string]> = [
  ["/dashboard", "Vue d'ensemble"],
  ["/dashboard/capteurs", "Capteurs"],
  ["/dashboard/journaux", "Journaux"],
  ["/dashboard/assistant", "Assistant IA"],
  ["/dashboard/conversations", "Conversations"],
  ["/dashboard/controle", "Contrôle du robot"],
  ["/dashboard/parametres", "Paramètres"],
];

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <SettingsProvider>
        <MilesProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </MilesProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  it("links to every page of version 1", () => {
    renderSidebar();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(NAV.length);

    for (const [href, label] of NAV) {
      const link = links.find(
        (element) => element.getAttribute("href") === href,
      );
      expect(link, `lien manquant : ${href}`).toBeDefined();
      expect(link?.textContent).toContain(label);
    }
  });

  it("does not point to modules that are not implemented yet", () => {
    renderSidebar();

    const hrefs = screen
      .getAllByRole("link")
      .map((element) => element.getAttribute("href"));

    expect(hrefs).not.toContain("/dashboard/vision");
    expect(hrefs).not.toContain("/dashboard/audio");
    expect(hrefs).not.toContain("/dashboard/materiel");
    expect(hrefs).not.toContain("/dashboard/services");
  });
});
