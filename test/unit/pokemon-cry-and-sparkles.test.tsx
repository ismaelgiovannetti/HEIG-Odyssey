// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { playPokemonCry } from "@/lib/audio/pokemon-cry";
import { ShinySparkles } from "@/components/pokemon/shiny-sparkles";

describe("pokemon-cry and shiny-sparkles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("playPokemonCry", () => {
    it("joue le cri d'un Pokémon sans lever d'erreur", () => {
      const playMock = vi.fn().mockResolvedValue(undefined);
      const pauseMock = vi.fn();
      vi.stubGlobal(
        "Audio",
        vi.fn().mockImplementation(function (this: any, url: string) {
          this.src = url;
          this.play = playMock;
          this.pause = pauseMock;
          this.volume = 1;
        }),
      );

      expect(() => playPokemonCry("pikachu")).not.toThrow();
      expect(playMock).toHaveBeenCalled();
    });

    it("gère l'option interrupt: false sans couper le son précédent", () => {
      const playMock = vi.fn().mockResolvedValue(undefined);
      const pauseMock = vi.fn();
      vi.stubGlobal(
        "Audio",
        vi.fn().mockImplementation(function (this: any, url: string) {
          this.src = url;
          this.play = playMock;
          this.pause = pauseMock;
          this.volume = 1;
        }),
      );

      playPokemonCry("charizard", { interrupt: false });
      playPokemonCry("blastoise", { interrupt: false });

      expect(playMock).toHaveBeenCalledTimes(2);
      expect(pauseMock).not.toHaveBeenCalled();
    });
  });

  describe("ShinySparkles Component", () => {
    it("affiche le conteneur d'étincelles avec les étoiles lorsqu'il est actif", () => {
      const { container } = render(<ShinySparkles active />);
      const sparkles = container.querySelector("[aria-hidden='true']");
      expect(sparkles).not.toBeNull();
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(10);
    });

    it("ne rend rien lorsque active est faux", () => {
      const { container } = render(<ShinySparkles active={false} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
