import React, { useState } from 'react';
import { Input, Button, Row, Col, Flex } from 'antd';
import { MinusCircleOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { parsePhoneNumber } from 'libphonenumber-js';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseConfig from './firebaseConfig';
import 'firebase/functions';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const NameList = () => {

    const [rows, setRows] = useState([{ name: '', phone: '', isValid: true }]);
    const [isSending, setIsSending] = useState(false);

    const handleAddRow = () => {
        const newRow = { name: '', phone: '', isValid: true };
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const verifyPhone = (phone) => {
        try {
            let number = ''
            if (phone[0] !== '+') {
                number = parsePhoneNumber(`+1${phone}`);
            } else {
                number = parsePhoneNumber(phone);
            }
            return (number.isValid());
        } catch (error) {
            return (false);
        }
    };

    const handleInputChange = (e, index, fieldName) => {
        const newRows = [...rows];
        newRows[index][fieldName] = e.target.value;

        // Validate phone number if the field is 'phone'
        if (fieldName === 'phone') {
            newRows[index].isValid = verifyPhone(e.target.value);
        }

        setRows(newRows);
    };

    const handleCreateHat = async () => {
        const shuffledNames = shuffleArray(rows.map((row, index) => ({ ...row, index })));
        const assigned = assignRecipients(shuffledNames);

        for (let person of assigned) {
            const message = `Hello ${getFirstName(person.name)}, you have been assigned to gift ${assigned.find(p => p.index === person.recipient).name}!`;
            await sendSMS(person.phone, message);
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

    const sendSMS = async (phoneNumber, message) => {
        const sendTwilioSMS = httpsCallable(functions, 'sendTwilioSMS');
        try {
            if (phoneNumber[0] !== '+') {
                phoneNumber = `+1${phoneNumber}`;
            }
            setIsSending(true);
            const result = await sendTwilioSMS({ to: phoneNumber, body: message });
            setIsSending(false)
            console.log(result);
        } catch (error) {
            setIsSending(false)
            console.error('Error sending SMS:', error);
        }
    };

    return (
        <div>
            {rows.map((row, index) => (
                <Row key={index} style={{ marginBottom: '10px', border: row.isValid ? 'none' : '1px solid red' }}>
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
                    <Col span={9}>
                        <Input
                            placeholder="Name"
                            value={row.name}
                            onChange={(e) => handleInputChange(e, index, 'name')}
                        />
                    </Col>
                    &nbsp;
                    <Col span={9}>
                        <Input
                            placeholder="Phone Number"
                            value={row.phone}
                            onChange={(e) => handleInputChange(e, index, 'phone')}
                            status={!row.isValid && 'error'}
                        />
                    </Col>
                </Row>
            ))}
            <Flex justify="center">
                <Button type="primary" onClick={handleAddRow} icon={<PlusOutlined />}>
                    Add
                </Button>
                &nbsp;
                <Button
                    type="primary"
                    onClick={handleCreateHat}
                    icon={<SendOutlined />}
                    disabled={
                        !(rows.length > 1)
                        && rows.some((row) =>
                            row.name === ''
                            || row.phone === ''
                            || !row.isValid
                        )
                    }
                    loading={isSending}
                >
                    Create Hat!
                </Button>
            </Flex>
        </div>
    );
};

export default NameList;
