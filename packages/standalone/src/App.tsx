import data from "@gi-tcg/data";
import { GameIO, PlayerConfig, startGame } from "@gi-tcg/core";

import { createPlayer, createWaitNotify } from "@gi-tcg/webui-core";
import { Show, createSignal } from "solid-js";
import { decode } from "./sharingCode";
// 等 @genshin-db/tcg 更新后可以从那儿获取
import sharingMap from "./sharingMap.json";

function getPlayerConfig(shareCode: string): PlayerConfig {
  const [ch0, ch1, ch2, ...cards] = decode(shareCode).map(
    (sid) => (sharingMap as any)[sid],
  );
  return {
    characters: [ch0, ch1, ch2],
    cards,
    noShuffle: import.meta.env.DEV,
    alwaysOmni: import.meta.env.DEV,
  };
}

export function App() {
  const [started, setStarted] = createSignal(false);
  const [deck0, setDeck0] = createSignal(
    "AbAw+gkPAsBQ/dsPDeGhAToQDiHQA/EQD0EgBfMQD2FAB/UQD4FgO/cTD8GAPfkND9AA",
  );
  //"AVCg3jUPA0Bw9ZUPCVCw9qMPCoBw+KgPDNEgCMIQDKFgCsYQDLGQC8kQDeEQDtEQDfAA"
  const [deck1, setDeck1] = createSignal(
    "AbAw+gkPAsBQ/dsPDeGhAToQDiHQA/EQD0EgBfMQD2FAB/UQD4FgO/cTD8GAPfkND9AA",
  );
  //"AeFB8ggQAxEB85gQCkFx9b4QDVEh9skQDWGR+coQDdLRA9wRDqLxDOARD7IBD+ERD+EB"
  const [io0, Chessboard0] = createPlayer(0);
  const [io1, Chessboard1] = createPlayer(1);

  const [pausing, pause, resume] = createWaitNotify();

  const onStart = () => {
    const playerConfig0 = getPlayerConfig(deck0());
    const playerConfig1 = getPlayerConfig(deck1());
    const io: GameIO = {
      pause,
      players: [io0, io1],
    };
    startGame({
      data,
      io,
      playerConfigs: [playerConfig0, playerConfig1],
    });
    setStarted(true);
  };

  return (
    <div>
      <Show
        when={started()}
        fallback={
          <div>
            <label>Player 0</label>
            <input
              type="text"
              value={deck0()}
              onInput={(e) => setDeck0(e.currentTarget.value)}
            />
            <br />
            <label>Player 1</label>
            <input
              type="text"
              value={deck1()}
              onInput={(e) => setDeck1(e.currentTarget.value)}
            />
            <br />
            <button onClick={onStart}>Start</button>
          </div>
        }
      >
        <div>
          <button disabled={!pausing()} onClick={resume}>
            Step
          </button>
        </div>
        <Chessboard0 />
        <Chessboard1 />
      </Show>
    </div>
  );
}
