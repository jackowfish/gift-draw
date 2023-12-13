// Import React and Ant Design components
import React, { useState } from "react";
import { Button } from "antd";
import NameList from "./NameList";

const GiftDraw = () => {
  const [listOpen, setListOpen] = useState(false);
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      {!listOpen && (
        <>
          <div class="wrapper">
            <svg>
              <text x="50%" y="50%" dy=".35em" text-anchor="middle">
                GIFT DRAW
              </text>
            </svg>
          </div>
          <Button type="primary" size="large" onClick={setListOpen} style={{ backgroundColor: 'Indianred' }}>
            Create a hat
          </Button>
        </>
      )}
      <NameList listOpen={listOpen} setListOpen={setListOpen} />
    </div>
  );
};

export default GiftDraw;
