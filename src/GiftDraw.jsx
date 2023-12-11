// Import React and Ant Design components
import React, { useState } from "react";
import { Button, Typography } from "antd";
import NameList from "./NameList";

// Destructure Title from Typography
const { Title } = Typography;

const GiftDraw = () => {
  const [listOpen, setListOpen] = useState(false);
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      {!listOpen && (
        <>
          <Title>GIFTDRAW</Title>
          <Button type="primary" size="large" onClick={setListOpen}>
            Create a hat
          </Button>
        </>
      )}
      {listOpen && (
        <NameList />
      )}
    </div>
  );
};

export default GiftDraw;
