<script lang="ts">
	import LegalPage from "$lib/components/legal/LegalPage.svelte";

	const sections = [
		{
			title: "Aceitação dos termos",
			paragraphs: [
				"Estes Termos de Serviço regulam seu acesso e uso da Vanda Studio. Ao usar o serviço, você concorda com estes termos.",
				"Se você usa a Vanda Studio em nome de uma empresa ou organização, você declara que tem autoridade para aceitar estes termos em nome dessa organização.",
			],
		},
		{
			title: "Serviço",
			paragraphs: [
				"A Vanda Studio oferece ferramentas para criação de conteúdo para redes sociais, geração de mídia, composição de posts, agendamento, análises e gerenciamento de contas. Alguns recursos podem depender de plataformas de terceiros, como Instagram, Meta, provedores de autenticação, processadores de pagamento, provedores de IA e provedores de hospedagem.",
			],
		},
		{
			title: "Suas responsabilidades",
			items: [
				"Fornecer informações corretas sobre sua conta e seus projetos.",
				"Usar o serviço apenas para fins legais e em conformidade com os termos das plataformas aplicáveis.",
				"Garantir que você possui os direitos necessários para enviar, gerar, publicar e usar o conteúdo gerenciado pela Vanda Studio.",
				"Revisar conteúdos gerados antes de publicá-los.",
				"Manter suas credenciais seguras e nos informar em caso de acesso não autorizado.",
			],
		},
		{
			title: "Integrações com plataformas sociais",
			paragraphs: [
				"Ao conectar uma conta social, você autoriza a Vanda Studio a acessar dados e executar ações de acordo com as permissões aprovadas por você. Recursos das plataformas podem mudar, ficar indisponíveis ou exigir nova autorização.",
				"Você é responsável por cumprir os termos e políticas de qualquer plataforma conectada, incluindo as políticas da Meta e do Instagram.",
			],
		},
		{
			title: "Conteúdo gerado",
			paragraphs: [
				"A Vanda Studio pode usar sistemas de IA para gerar legendas, imagens, briefings e recomendações. Saídas de IA podem ser imprecisas ou inadequadas. Você é responsável por revisar e aprovar conteúdos antes do uso ou publicação.",
			],
		},
		{
			title: "Pagamentos e planos",
			paragraphs: [
				"Alguns recursos podem exigir um plano pago ou créditos de uso. Preços, limites e detalhes dos planos são exibidos no app ou no fluxo de checkout. Pagamentos são processados por nossos provedores de pagamento e podem estar sujeitos a termos adicionais desses provedores.",
			],
		},
		{
			title: "Suspensão e encerramento",
			paragraphs: [
				"Podemos suspender ou encerrar o acesso se você violar estes termos, criar riscos para a Vanda Studio ou outros usuários, usar integrações de plataforma indevidamente ou usar o serviço de forma que possa causar danos legais, de segurança ou operacionais.",
			],
		},
		{
			title: "Isenções",
			paragraphs: [
				"O serviço é fornecido no estado em que se encontra e conforme disponibilidade. Não garantimos disponibilidade ininterrupta, resultados específicos em redes sociais, crescimento de seguidores, níveis de engajamento, sucesso de publicação ou disponibilidade contínua de recursos de plataformas de terceiros.",
			],
		},
		{
			title: "Contato",
			paragraphs: [
				"Para dúvidas sobre estes termos, entre em contato pelo canal de suporte indicado no app da Vanda Studio ou pelo e-mail de contato configurado para a Vanda Studio no Meta for Developers.",
			],
		},
	];
</script>

<LegalPage
	title="Termos de Serviço"
	description="Os termos aplicáveis ao acesso e uso da Vanda Studio."
	updatedAt="23 de abril de 2026"
	{sections}
/>
