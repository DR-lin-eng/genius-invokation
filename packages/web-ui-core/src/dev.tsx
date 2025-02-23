// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/* @refresh reload */

import "./index";
import { batch, createSignal, onMount, Show, untrack } from "solid-js";
import { render } from "solid-js/web";

import getData from "@gi-tcg/data";
import { type DetailLogEntry, Game, type DeckConfig } from "@gi-tcg/core";
import { createPlayer } from "@gi-tcg/webui";
import { createClient } from "./client";

const deck0: DeckConfig = {
  characters: [1214, 1403, 1203],
  cards: [
    332025, 331801, 332042, 331802, 332006, 332042, 223041, 223041, 226031,
    226031, 312009, 312009, 312010, 312010, 313002, 313002, 321002, 321004,
    321017, 321017, 322008, 322012, 322012, 322025, 332004, 332004, 332006,
    332032, 332032, 332041, 332041,
  ],
  noShuffle: import.meta.env.DEV,
};
const deck1: DeckConfig = {
  characters: [1709, 1201, 1608],
  cards: [
    323008, 332003, 332040, 322008, 332037, 333006, 332004,
    312023, 312023, 332011, 321004, 321004, 321024,
    321024, 322018, 322018, 331202, 331202, 332004, 332004, 332006, 332006,
    332025, 332031, 332032, 332032, 332040, 332040, 333015, 333015,
  ],
  noShuffle: import.meta.env.DEV,
};

function App() {
  let cb0!: HTMLDivElement;
  let cb1!: HTMLDivElement;

  const [newIo1, NewChessboard] = createClient(1);

  onMount(() => {
    const state = Game.createInitialState({
      data: getData(),
      decks: [deck0, deck1],
      // initialHandsCount: 10,
    });
    const io0 = createPlayer(cb0, 0);
    const io1 = createPlayer(cb1, 1);

    const game = new Game(state);

    game.players[0].io = io0;
    game.players[1].io = {
      ...newIo1,
      notify: async (n) => {
        io1.notify(n);
        newIo1.notify(n);
      },
    };
    game.players[0].config.alwaysOmni = true;
    game.players[0].config.allowTuningAnyDice = true;
    game.onIoError = console.error;
    game.start();
    // game.giveUp
    Reflect.set(window, "game", game);
  });

  return (
    <div class="min-w-180 flex flex-col gap-2">
      <div ref={cb0} />
      <details>
        <div ref={cb1} />
      </details>
      <NewChessboard class="h-0" />
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
