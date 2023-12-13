import React, { useState } from "react";
import { Button, Flex, Popover } from "antd";
import NameList from "./NameList";
import logo from "./logo.svg";
import InfoCircleOutlined from "@ant-design/icons/InfoCircleOutlined";


const GiftDraw = () => {
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <Flex vertical gap={24} align="center">
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
            <Flex gap={0} style={{ marginLeft: '8px' }}>
              <Button type="primary" size="large" onClick={setListOpen} style={{ backgroundColor: 'Indianred', width: '100%' }}>
                Create a hat
              </Button>
              <Popover
                placement="top"
                content={'\
                  Gift Draw is a simple web app that allows you to create a "hat"\
                  of your friends or families names and emails.\
                  Giftdraw draws names from the hat and sends them out to everyone\
                  to let them know who is getting a present for who!\
                  Thiink of it as a secret santa hat, but for any occasion!\
                  '}
                title="What is this?"
                trigger="click"
                open={open}
                onOpenChange={handleOpenChange}
              >
                <Button
                  type="secondary"
                  icon={<InfoCircleOutlined />}
                />
              </Popover>
            </Flex>
          </>
        )}
        <NameList listOpen={listOpen} setListOpen={setListOpen} />
      </Flex>
      <p style={{ position: "fixed", bottom: 0, width: "100%", textAlign: "center", color: "grey" }}>
        Made with ❤️ by Jack Decker
      </p>
    </div>
  );
};

export default GiftDraw;
