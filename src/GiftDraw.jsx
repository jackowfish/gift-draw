import React, { useState } from "react";
import logo from "./logo.svg";
import { Button, Flex } from "antd";
import NameList from "./NameList";

const GiftDraw = () => {
  const [listOpen, setListOpen] = useState(false);
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <Flex vertical gap={12} align="center">
        <img src={logo} className="App-logo" alt="logo" />
        {!listOpen && (
          <>
            <div class="wrapper">
              <svg>
                <text x="50%" y="50%" dy=".35em" text-anchor="middle">
                  GIFT DRAW
                </text>
              </svg>
            </div>
            <Button type="primary" size="large" onClick={setListOpen} style={{ backgroundColor: 'Indianred', width: '50%' }}>
              Create a hat
            </Button>
          </>
        )}
      </Flex>
      <NameList listOpen={listOpen} setListOpen={setListOpen} />
      <p style={{ position: "fixed", bottom: 0, width: "100%", textAlign: "center", color: "grey" }}>
        Made with ❤️ by Jack Decker
      </p>
    </div>
  );
};

export default GiftDraw;
