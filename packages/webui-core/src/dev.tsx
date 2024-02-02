/* @refresh reload */
import "solid-devtools";
import { render } from "solid-js/web";

import data from "@gi-tcg/data";
import { GameIO, PlayerConfig, startGame } from "@gi-tcg/core";

import { createPlayer } from "./index";
import { createWaitNotify } from "./utils";

const playerConfig0: PlayerConfig = {
  characters: [1303, 1201, 1505],
  cards: [
    332015, 332009, 332002, 331602, 331302, 331402, 331502, 331102, 331202,
    331702, 331301, 331101, 331601, 331401, 331201, 331701, 331501, 332016,
    332020, 332014, 332004, 332018, 332005, 332006, 332024, 332010, 331804,
    332023, 332017, 332012, 332021, 332013, 332008, 331802, 332004, 332001,
    332019, 331803, 332003, 332007, 332022, 331801, 332011,
  ],
  // noShuffle: import.meta.env.DEV,
  // alwaysOmni: import.meta.env.DEV,
};
const playerConfig1: PlayerConfig = {
  characters: [1502, 1201, 1303],
  cards: [
    332015, 332009, 332002, 331602, 331302, 331402, 331502, 331102, 331202,
    331702, 331301, 331101, 331601, 331401, 331201, 331701, 331501, 332016,
    332020, 332014, 332004, 332018, 332005, 332006, 332024, 332010, 331804,
    332023, 332017, 332012, 332021, 332013, 332008, 331802, 332004, 332001,
    332019, 331803, 332003, 332007, 332022, 331801, 332011,
  ],
  noShuffle: import.meta.env.DEV,
  alwaysOmni: import.meta.env.DEV,
};

function App() {
  const [io0, Chessboard0] = createPlayer(0);
  const [io1, Chessboard1] = createPlayer(1);

  const [pausing, pause, resume] = createWaitNotify();

  const io: GameIO = {
    pause,
    players: [io0, io1],
  };
  startGame({
    data,
    io,
    playerConfigs: [playerConfig0, playerConfig1],
  });

  return (
    <div class="min-w-180 flex flex-col gap-2">
      <div>
        <button disabled={!pausing()} onClick={resume}>
          Step
        </button>
      </div>
      <Chessboard0 />
      <Chessboard1 />
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
