import React, { useState } from 'react';
import { Input, Button, Row, Col, Flex, Select } from 'antd';
import { MinusCircleOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseConfig from './firebaseConfig';
import 'firebase/functions';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const rowsInit = [{ name: '', email: '', domain: '@gmail.com', isValid: true }];

const NameList = ({ listOpen, setListOpen }) => {
    const [rows, setRows] = useState([...rowsInit]);
    const [isSending, setIsSending] = useState(false);

    const handleAddRow = () => {
        const newRow = { name: '', email: '', domain: '@gmail.com', isValid: true };
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const isEmailValid = (email) => {
        console.log(email);
        const regexPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        return regexPattern.test(email);
    };

    const handleDomainChange = (value, index) => {
        const newRows = [...rows];
        newRows[index].domain = value;
        setRows(newRows);
    };

    const handleInputChange = (e, index, fieldName) => {
        const newRows = [...rows];
        newRows[index][fieldName] = e.target.value;

        // Validate email number if the field is 'email'
        if (fieldName === 'email') {
            newRows[index].isValid = isEmailValid(e.target.value + newRows[index].domain);
        }

        setRows(newRows);
    };

    const handleCreateHat = async () => {
        const shuffledNames = shuffleArray(rows.map((row, index) => ({ ...row, index })));
        const assigned = assignRecipients(shuffledNames);

        for (let person of assigned) {
            const message = `Hello ${getFirstName(person.name)}, you have been assigned to gift ${assigned.find(p => p.index === person.recipient).name}!`;
            await sendEmail(person.email + person.domain, message);
        }
    };

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const assignRecipients = (shuffled) => {
        for (let i = 0; i < shuffled.length; i++) {
            shuffled[i].recipient = (i + 1) % shuffled.length;
        }
        return shuffled;
    };

    const getFirstName = (fullName) => {
        return fullName.split(' ')[0];
    };

    const sendEmail = async (email, message) => {
        const sendEmail = httpsCallable(functions, 'sendGmail');
        try {
            if (email[0] !== '+') {
                email = `+1${email}`;
            }
            setIsSending(true);
            const result = await sendEmail({ to: email, subject: 'Your pick out of the hat!', text: message });
            setIsSending(false)
            console.log(result);
        } catch (error) {
            setIsSending(false)
            console.error('Error sending email:', error);
        }
    };

    return listOpen && (
        <div>
            {rows.map((row, index) => {
                const selectAfter = (
                    <Select
                        defaultValue="@gmail.com"
                        onChange={(value) => handleDomainChange(value, index)}
                    >
                        <Select.Option value="@gmail.com">@gmail.com</Select.Option>
                        <Select.Option value="@yahoo.com">@yahoo.com</Select.Option>
                        <Select.Option value="@hotmail.com">@hotmail.com</Select.Option>
                        <Select.Option value="@outlook.com">@outlook.com</Select.Option>
                        <Select.Option value="@aol.com">@aol.com</Select.Option>
                        <Select.Option value="@icloud.com">@icloud.com</Select.Option>
                        <Select.Option value="@mail.com">@mail.com</Select.Option>
                        <Select.Option value="@protonmail.com">@protonmail.com</Select.Option>
                        <Select.Option value=".org">.org</Select.Option>
                        <Select.Option value=".com">.com</Select.Option>
                        <Select.Option value=".net">.com</Select.Option>
                    </Select>
                );
                return (
                    <Row key={index} style={{ marginBottom: '10px' }}>
                        <Col span={2}>
                            {index !== 0 && (
                                <Button
                                    type="danger"
                                    shape="circle"
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => handleRemoveRow(index)}
                                />
                            )}
                        </Col>
                        <Col span={8}>
                            <Input
                                placeholder="Name"
                                value={row.name}
                                onChange={(e) => handleInputChange(e, index, 'name')}
                            />
                        </Col>
                        &nbsp;
                        <Col span={12}>
                            <Input
                                placeholder="Email"
                                value={row.email}
                                onChange={(e) => handleInputChange(e, index, 'email')}
                                status={!row.isValid && 'error'}
                                addonAfter={selectAfter}
                            />
                        </Col>
                    </Row>
                )
            })}
            <Flex justify="center" gap={8}>
                <Button type="primary" onClick={handleAddRow} icon={<PlusOutlined />}>
                    Add
                </Button>
                <Button
                    type="primary"
                    onClick={handleCreateHat}
                    icon={<SendOutlined />}
                    disabled={
                        !(rows.length > 1)
                        || rows.some((row) => row.name === '' || row.email === '' || !row.isValid)
                    }
                    loading={isSending}
                >
                    Create Hat!
                </Button>
                <Button
                    type="primary"
                    style={{
                        background: "IndianRed",
                    }}
                    onClick={() => {
                        setRows([...rowsInit]);
                        setListOpen(false)
                    }}
                    disabled={isSending}
                >
                    Back
                </Button>
            </Flex>
        </div>
    );
};

export default NameList;
