import mongoose from 'mongoose';
import * as Yup from 'yup';

import Chat from '../models/Chat';
import User from '../models/User';
import Product from '../models/Product';

// OBJETO MENSAGEM
// id: {
//     type: String,
//     default: mongoose.Types.ObjectId(),
// },
// content: {
//     type: String,
//     required: true,
// },
// date: {
//     type: Date,
//     required: true,
// },
// sent_by: {
//     type: String,
//     required: true,
// },

class ChatController {
    async initialize(req, res) {
        const { user, product, seller } = req.body;

        if (user === seller) {
            return res
                .status(400)
                .json({ error: 'Você não pode comprar seu próprio produto' });
        }

        const findUser = await User.findById(user).catch(() =>
            console.log('Usuário não encontrado!')
        );

        if (!findUser) {
            return res.status(404).json({ error: 'Usuário não encontrado!' });
        }

        const findChat = await Chat.find({ buyer: user, product }).catch(() =>
            console.log('Chat não encontrado')
        );

        if (findChat[0]) {
            return res.status(400).json({ error: 'Chat já criado!' });
        }

        const matchProduct = await Product.find({
            user: seller,
            id: product,
        }).catch(() => console.log('Produto não encontrado!'));

        if (!matchProduct) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const chat = new Chat({
            buyer: user,
            seller,
            product,
            messagesLength: 1,
            messages: [
                {
                    id: mongoose.Types.ObjectId(),
                    content:
                        'Bem vindo ao chat da lojinha! Tome cuidado com quais informações com quais informações compartilhar!',
                    date: Date.now,
                    sent_by: 'chat',
                },
            ],
        });

        chat.save();

        return res.json(chat);
    }

    async store(req, res) {
        const { message, user, chat, sent_by } = req.body;

        const schema = Yup.object().shape({
            message: Yup.string().required(),
            sent_by: Yup.string().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Mensagem inválida!' });
        }

        const findChat = await Chat.findById(chat).catch(() =>
            console.log('Chat não encontrado!')
        );

        if (!findChat) {
            return res.status(404).json({ error: 'Chat não encontrado!' });
        }

        if (findChat.buyer != user && findChat.seller != user) {
            return res
                .status(401)
                .json({ error: 'Você não pode acessar esse chat!' });
        }

        const messageObj = {
            id: mongoose.Types.ObjectId(),
            content: message,
            date: new Date(),
            sent_by,
        };

        findChat.messages.push(messageObj);
        findChat.messagesLenght += 1;

        findChat.last_message = new Date();
        findChat.save();
        // salva a mensagem no banco de dados

        // await req.io.to(findChat.id).emit('sendMessage', messageObj);
        await req.io.emit('sendMessage', messageObj);
        // Manda a mensagem para o chat em tempo real

        // NOTIFICAR USUÁRIO QUE RECEBE MENSAGEM

        return res.json({ message: 'Ok!' });
    }

    async index(req, res) {
        const { id, user } = req.params;

        const findChat = await Chat.findById(id)
            .populate({
                path: 'buyer',
                select: ['-password_hash', '-created-at'],
            })
            .populate({
                path: 'seller',
                select: ['-password_hash', '-created-at'],
            })
            .populate({
                path: 'product',
                select: ['-user', '-description', '-created-at'],
                populate: 'picture',
            })
            .catch(() => {
                console.log('Chat não encontrado!');
            });

        if (!findChat) {
            return res.status(404).json({ error: 'Chat não encontrado!' });
        }

        if (findChat.buyer.id != user && findChat.seller.id != user) {
            return res
                .status(401)
                .json({ error: 'Você não pode acessar esse chat!' });
        }

        return res.json(findChat);
    }

    async show(req, res) {
        const { user } = req.params;

        const chatData = await Chat.find({
            $or: [{ buyer: user }, { seller: user }],
        })
            .populate({
                path: 'buyer',
                select: ['-password_hash', '-created-at'],
            })
            .populate({
                path: 'seller',
                select: ['-password_hash', '-created-at'],
            })
            .populate({
                path: 'product',
                select: ['-user', '-description', '-created-at'],
                populate: 'picture',
            })
            .catch(() => console.log('Usuário não possui chats!'));
        // Procura por chats onde o usuário é ou comprador ou vendedor ($or)

        if (!chatData) {
            return res.json();
        }
        return res.json(chatData);
    }
}

export default new ChatController();